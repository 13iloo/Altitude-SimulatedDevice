// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict"

// The device connection string to authenticate the device with your IoT hub.
//
// NOTE:
// For simplicity, this sample sets the connection string in code.
// In a production environment, the recommended approach is to use
// an environment variable to make it available to your application
// or use an HSM or an x509 certificate.
// https://docs.microsoft.com/azure/iot-hub/iot-hub-devguide-security
//
// Using the Azure CLI:
// az iot hub device-identity show-connection-string --hub-name {YourIoTHubName} --device-id MyNodeDevice --output table
const connectionString =
    "HostName=boDataHub.azure-devices.net;DeviceId=AltitudeDevice;SharedAccessKey=St88sTu5NypqHm0ZuT/nz2zsnGoxFYFZB2r1zqsDeM4="

// Using the Node.js Device SDK for IoT Hub:
//   https://github.com/Azure/azure-iot-sdk-node
// The sample connects to a device-specific MQTT endpoint on your IoT Hub.
import { Mqtt } from "azure-iot-device-mqtt"

// azure-iot-device is a common.js module so we need to pick out and convert from import
import pkg from "azure-iot-device"
const { Client: DeviceClient, Message } = pkg

// The client proxy on the simulated device, the one talking to Azure Iot devices
const client = DeviceClient.fromConnectionString(connectionString, Mqtt)

// Helper function to print results in the console
function printSendEventResult(error, result) {
    if (error) console.log("sendEvent error: " + error.toString())
    if (result) console.log("sendEvent status: " + result.constructor.name)
}

let currentAltitude = 0 // Start at 0 meters
let phase = "Lift Off" // Initial phase
let cruisingTime = Math.floor(Math.random() * 55000) + 5000 // Random cruising time between 5-60 seconds
let cruisingStarted = false

function generateMessage() {
    // Determine the behavior based on the current phase
    if (phase === "Lift Off") {
        // The plane is climbing steadily towards 10,000 meters (commercial plane altitude)
        currentAltitude += Math.random() * 300 + 100 // Increase between 100 and 300 meters
        if (currentAltitude >= 10000) {
            phase = "cruising" // Switch to cruising when reaching 10,000 meters
            cruisingStarted = true
            console.log(
                `Cruising started. Time: ${cruisingTime / 1000} seconds`
            )
            setTimeout(() => {
                phase = "Landing" // Switch to Landing after cruising time
                console.log("Cruising finished. Starting Landing...")
            }, cruisingTime) // Set a timer for the cruising phase
        }
    } else if (phase === "cruising") {
        // The plane is cruising at a steady altitude around 10,000 meters
        currentAltitude += Math.random() * 20 - 10 // Small fluctuation of ±10 meters
        currentAltitude = Math.min(currentAltitude, 15000)
    } else if (phase === "Landing") {
        // The plane is steadily descending
        currentAltitude -= Math.random() * 300 + 100 // Decrease between 100 and 300 meters
        currentAltitude = Math.max(0, currentAltitude) // Ensure altitude doesn't go below 0
    }

    // Create the telemetry message with the current altitude
    const message = new Message(
        JSON.stringify({
            altitude: currentAltitude.toFixed(1),
        })
    )

    message.contentEncoding = "utf-8"
    message.contentType = "application/json"

    // Add an alert property if altitude is very low (e.g., below 10 meters)
    message.properties.add(
        "altitudeAlert",
        currentAltitude > 15000 || currentAltitude < 1000 ? "false" : "true"
    )

    console.log(
        `Altitude: ${currentAltitude.toFixed(1)} meters (Phase: ${phase})`
    )

    return message
}

// Setup the handlers, sendInterval is used to start and stop sending of telemetry data
let sendInterval

function disconnectHandler() {
    clearInterval(sendInterval)
    sendInterval = null
    console.log("Client disconnected")
}

function errorHandler(err) {
    console.error(err.message)
}

function connectHandler() {
    console.log("Client connected")
    // Create a message and send it to the IoT Hub every two seconds
    if (!sendInterval) {
        sendInterval = setInterval(() => {
            const message = generateMessage()
            console.log("Trying to send message: " + message.getData())
            client.sendEvent(message, printSendEventResult);
        }, 1000)
    }
}

client.on("connect", connectHandler)
client.on("error", errorHandler)
client.on("disconnect", disconnectHandler)

const main = async () => {
    console.log("main started")

    try {
        await client.open()
    } catch (error) {
        console.error("Could not connect: " + error.message)
    }
}

main()
