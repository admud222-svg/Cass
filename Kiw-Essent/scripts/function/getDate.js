import { world, system } from "@minecraft/server";

var day, month, year, hour, minute;

system.runInterval(() => {
    const timezone = world.getDynamicProperty("time:timezone") ?? "UTC+7";
    const offset = parseInt(timezone.replace("UTC", "")) * 3600000;
    
    var currentDate = new Date(Date.now() + offset);
    var months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    day = String(currentDate.getDate()).padStart(2, "0");
    month = months[currentDate.getMonth()];
    year = String(currentDate.getFullYear());
    hour = String(currentDate.getHours()).padStart(2, "0");
    minute = String(currentDate.getMinutes()).padStart(2, "0");
}, 20); // Update setiap 1 detik

export { day, month, year, hour, minute };