// Main game constants
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const ROAD_WIDTH = 2000;
const SEGMENT_LENGTH = 200;
const RUMBLE_LENGTH = 3;
const DRAW_DISTANCE = 300;
const CAMERA_HEIGHT = 1000;
const CAMERA_DEPTH = 0.84;
const LANES = 3;

// Car constants
const MAX_SPEED = 200;
const ACCELERATION = 0.1;
const DECELERATION = 0.3;
const HANDLING = 0.3;

// Colors
const COLORS = {
    SKY: '#72D7EE',
    SUNSET: {
        TOP: '#FF8844',
        BOT: '#FFCC33'
    },
    TREE: '#005108',
    FOG: '#005108',
    LIGHT: { road: '#8F8F8F', grass: '#10AA10', rumble: '#BBBBBB', lane: '#FFFFFF' },
    DARK: { road: '#696969', grass: '#009A00', rumble: '#FF4500', lane: '#CCCCCC' }
};

// Game variables
let canvas, ctx;
let position = 0;
let speed = 0;
let playerX = 0;
let segments = [];
let cityBuildings = [];

// Initialize the game
window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');
    
    resetRoad();
    generateCityBuildings();
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    requestAnimationFrame(gameLoop);
};

// Generate city buildings once
function generateCityBuildings() {
    cityBuildings = [];
    for(let i = 0; i < 10; i++) {
        const building = {
            height: 40 + Math.random() * 80,
            width: 40 + Math.random() * 60,
            x: i * 70 + Math.random() * 20,
            windows: []
        };
        
        // Generate windows positions once
        for(let wy = 0; wy < building.height - 10; wy += 15) {
            for(let wx = 0; wx < building.width - 10; wx += 15) {
                if(Math.random() > 0.5) {
                    building.windows.push({x: wx, y: wy});
                }
            }
        }
        
        cityBuildings.push(building);
    }
}

// Key handlers
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

function handleKeyDown(e) {
    if (keys[e.key] !== undefined) {
        keys[e.key] = true;
        e.preventDefault();
    }
}

function handleKeyUp(e) {
    if (keys[e.key] !== undefined) {
        keys[e.key] = false;
        e.preventDefault();
    }
}

// Create road segments
function resetRoad() {
    segments = [];
    
    // Создаем идентичные сегменты в начале и конце трассы для бесшовного перехода
    for (let n = 0; n < 500; n++) {
        // Флаг, указывающий является ли сегмент переходным (для начала/конца трассы)
        const isTransition = n < 20 || n > 480;
        
        // Стандартная высота для обычных сегментов
        const y = 0;
        
        segments.push({
            index: n,
            p1: { world: { z: n * SEGMENT_LENGTH, y: y }, camera: {}, screen: {} },
            p2: { world: { z: (n + 1) * SEGMENT_LENGTH, y: y }, camera: {}, screen: {} },
            color: Math.floor(n / RUMBLE_LENGTH) % 2 ? COLORS.DARK : COLORS.LIGHT
        });
    }
}

// Project 3D world position to 2D screen position
function project(p, cameraX, cameraY, cameraZ, cameraDepth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = p.world.z - cameraZ;
    
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((CANVAS_WIDTH / 2) + (p.screen.scale * p.camera.x * CANVAS_WIDTH / 2));
    p.screen.y = Math.round((CANVAS_HEIGHT / 2) - (p.screen.scale * p.camera.y * CANVAS_HEIGHT / 2));
    p.screen.w = Math.round(p.screen.scale * ROAD_WIDTH * CANVAS_WIDTH / 2);
}

// Render a polygon on canvas
function renderPolygon(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
}

// Render the game scene
function renderScene(position, playerX) {
    const baseSegment = Math.floor(position / SEGMENT_LENGTH);
    const cameraHeight = CAMERA_HEIGHT;
    const maxy = CANVAS_HEIGHT;
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw sky (with sunset gradient)
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT / 2);
    gradient.addColorStop(0, COLORS.SUNSET.TOP);
    gradient.addColorStop(1, COLORS.SUNSET.BOT);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    
    // Draw distant mountains/city
    drawCitySkyline();
    
    // Draw a clear horizon line to prevent artifacts
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, CANVAS_HEIGHT / 2 - 1, CANVAS_WIDTH, 2);
    
    // Draw road segments
    let startSegment = baseSegment;
    let endSegment = startSegment + DRAW_DISTANCE;
    
    // Render road segments from back to front
    for (let n = startSegment; n < endSegment; n++) {
        const segmentIndex = n % segments.length;
        const segment = segments[segmentIndex];
        const looped = n >= segments.length;
        
        // Project segment onto screen
        project(segment.p1, playerX * ROAD_WIDTH, cameraHeight, position, CAMERA_DEPTH);
        project(segment.p2, playerX * ROAD_WIDTH, cameraHeight, position, CAMERA_DEPTH);
        
        // Skip if segment is behind the camera
        if (segment.p1.camera.z <= 0 && segment.p2.camera.z <= 0) continue;
        
        // Only draw if the segment is actually visible on screen
        if (segment.p2.screen.y >= maxy) continue;
        
        // Draw segment if it's on screen
        const x1 = segment.p1.screen.x;
        const y1 = segment.p1.screen.y;
        const w1 = segment.p1.screen.w;
        const x2 = segment.p2.screen.x;
        const y2 = segment.p2.screen.y;
        const w2 = segment.p2.screen.w;
        
        // Clip y1 to prevent drawing above the horizon
        const clippedY1 = Math.max(y1, CANVAS_HEIGHT / 2);
        
        // Draw grass
        renderPolygon(0, clippedY1, CANVAS_WIDTH, clippedY1, CANVAS_WIDTH, y2, 0, y2, segment.color.grass);
        
        // Draw road
        renderPolygon(x1 - w1, clippedY1, x1 + w1, clippedY1, x2 + w2, y2, x2 - w2, y2, segment.color.road);
        
        // Draw rumble strips
        const rumbleWidth1 = w1 / 5;
        const rumbleWidth2 = w2 / 5;
        renderPolygon(x1 - w1, clippedY1, x1 - w1 + rumbleWidth1, clippedY1, x2 - w2 + rumbleWidth2, y2, x2 - w2, y2, segment.color.rumble);
        renderPolygon(x1 + w1 - rumbleWidth1, clippedY1, x1 + w1, clippedY1, x2 + w2, y2, x2 + w2 - rumbleWidth2, y2, segment.color.rumble);
        
        // Draw lane markers
        if (segment.color.lane) {
            const lanew1 = w1 * 0.05;
            const lanew2 = w2 * 0.05;
            const lanex1 = x1 - w1 * 0.25;
            const lanex2 = x2 - w2 * 0.25;
            const lanex3 = x1 + w1 * 0.25;
            const lanex4 = x2 + w2 * 0.25;
            
            if (segmentIndex % 8 < 4) {
                renderPolygon(lanex1 - lanew1/2, clippedY1, lanex1 + lanew1/2, clippedY1, lanex2 + lanew2/2, y2, lanex2 - lanew2/2, y2, segment.color.lane);
                renderPolygon(lanex3 - lanew1/2, clippedY1, lanex3 + lanew1/2, clippedY1, lanex4 + lanew2/2, y2, lanex4 - lanew2/2, y2, segment.color.lane);
            }
        }
    }
    
    // Draw player car
    drawPlayerCar();
    
    // Draw HUD
    drawHUD();
}

// Draw city skyline in the background
function drawCitySkyline() {
    ctx.fillStyle = '#333333';
    
    // Draw pre-generated buildings
    for(let i = 0; i < cityBuildings.length; i++) {
        const building = cityBuildings[i];
        
        ctx.fillRect(building.x, CANVAS_HEIGHT / 2 - building.height, building.width, building.height);
        
        // Draw pre-generated windows
        ctx.fillStyle = '#FFCC00';
        for(let j = 0; j < building.windows.length; j++) {
            const window = building.windows[j];
            ctx.fillRect(building.x + 5 + window.x, CANVAS_HEIGHT / 2 - building.height + 5 + window.y, 8, 8);
        }
        ctx.fillStyle = '#333333';
    }
}

// Draw the player's car
function drawPlayerCar() {
    const carWidth = 80;
    const carHeight = 40;
    const carX = CANVAS_WIDTH / 2 - carWidth / 2;
    const carY = CANVAS_HEIGHT - carHeight - 20;
    
    // Car body
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(carX, carY, carWidth, carHeight * 0.5);
    
    // Car roof
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(carX + carWidth * 0.25, carY - carHeight * 0.2, carWidth * 0.5, carHeight * 0.2);
    
    // Windows
    ctx.fillStyle = '#000000';
    ctx.fillRect(carX + carWidth * 0.25, carY, carWidth * 0.5, carHeight * 0.2);
    
    // Wheels
    ctx.fillStyle = '#000000';
    ctx.fillRect(carX - 5, carY + carHeight * 0.3, 10, carHeight * 0.2);
    ctx.fillRect(carX + carWidth - 5, carY + carHeight * 0.3, 10, carHeight * 0.2);
    
    // Lights
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(carX + 5, carY, 10, 5);
    ctx.fillRect(carX + carWidth - 15, carY, 10, 5);
}

// Draw the HUD (speed, position, etc.)
function drawHUD() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`СКОРОСТЬ: ${Math.round(speed * 3.6)} км/ч`, 20, 30);
    
    // Speedometer
    drawSpeedometer(120, 80, 60, speed / MAX_SPEED);
    
    // Position and lap counter
    ctx.textAlign = 'right';
    ctx.fillText('1ST', CANVAS_WIDTH - 20, 30);
    ctx.fillText('LAP 1/4', CANVAS_WIDTH - 20, 60);
}

// Draw speedometer
function drawSpeedometer(x, y, radius, percentage) {
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI, 2 * Math.PI);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI, Math.PI + (percentage * Math.PI));
    ctx.lineWidth = 10;
    ctx.strokeStyle = percentage > 0.8 ? '#FF0000' : percentage > 0.5 ? '#FFFF00' : '#00FF00';
    ctx.stroke();
}

// Плавное перемещение игрока к целевой позиции
let targetPlayerX = 0;

// Update game logic
function update(dt) {
    // Acceleration and braking
    if (keys.ArrowUp) {
        speed = Math.min(speed + ACCELERATION, MAX_SPEED);
    } else if (keys.ArrowDown) {
        speed = Math.max(0, speed - DECELERATION * 2);
    } else {
        speed = Math.max(0, speed - DECELERATION);
    }
    
    // Steering - замедляем еще в 2 раза поворот и делаем более плавным
    if (speed > 0) {
        if (keys.ArrowLeft) targetPlayerX -= HANDLING * 0.125; // Уменьшено с 0.25 до 0.125
        if (keys.ArrowRight) targetPlayerX += HANDLING * 0.125; // Уменьшено с 0.25 до 0.125
        
        targetPlayerX = Math.max(-1, Math.min(1, targetPlayerX));
        
        playerX = playerX + (targetPlayerX - playerX) * 0.025; // Уменьшено с 0.05 до 0.025 для более плавного движения
    }
    
    // Movement
    position += speed;
    
    // Loop track - бесшовный переход
    if (position >= segments.length * SEGMENT_LENGTH) {
        position -= segments.length * SEGMENT_LENGTH; // Вместо сброса на ноль, вычитаем длину трассы
    }
}

// Main game loop
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = timestamp - (lastTime || timestamp);
    lastTime = timestamp;
    
    update(dt);
    renderScene(position, playerX);
    
    requestAnimationFrame(gameLoop);
}