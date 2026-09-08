/*
  Dicer.js 
  
  Created by: @justme_3k with help from Grok.
  
  April 21, 2025
  
  Rooler rools the dice.  custom dice. lots of dice. 
  Needs to work well on PC and mobile browsers.
 */
 
const gt = globalThis;
const PI = Math.PI;
diceBag=null;
dice = [];
heldDice = [];
tableSpots = [];
actions = [];
pauseMenuButtons = [];
popups = [];
pauseTriggers = [];
DEF_BG_FILL = '#448844';
BG_FILL = DEF_BG_FILL;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

{ // intersect funcs
  gt.pointInRect = function(pointX, pointY, corners) {
    if (corners.length !== 4) return false;
    let intersections = 0;
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      if (c1.y === c2.y) continue;
      const minY = Math.min(c1.y, c2.y);
      const maxY = Math.max(c1.y, c2.y);
      if (pointY < minY || pointY > maxY) continue;
      const t = (pointY - c1.y) / (c2.y - c1.y);
      const edgeX = c1.x + t * (c2.x - c1.x);
      if (pointX <= edgeX) intersections++;
    }
    return intersections % 2 === 1;
  }
  
  gt.lineLineIntersect = function(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const hitX = x1 + t * (x2 - x1);
      const hitY = y1 + t * (y2 - y1);
      return { x: hitX, y: hitY };
    }
    return null;
  }

  gt.lineRectIntersect = function(lineX1, lineY1, lineX2, lineY2, corners) {
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      const hit = lineLineIntersect(lineX1, lineY1, lineX2, lineY2, c1.x, c1.y, c2.x, c2.y);
      if (hit) return hit;
    }
    return null;
  }

  gt.circleRectIntersect = function(circleX, circleY, radius, corners) {
    if (corners.length !== 4) return null;

    let closestX = circleX;
    let closestY = circleY;

    const minX = Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
    const maxX = Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
    const minY = Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
    const maxY = Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y);

    closestX = Math.max(minX, Math.min(maxX, closestX));
    closestY = Math.max(minY, Math.min(maxY, closestY));

    const dx = circleX - closestX;
    const dy = circleY - closestY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared <= radius * radius) {
      if (distanceSquared === 0) return { x: circleX, y: circleY };
      const distance = Math.sqrt(distanceSquared);
      const t = radius / distance;
      const hitX = circleX - dx * t;
      const hitY = circleY - dy * t;
      return { x: hitX, y: hitY };
    }
    return null;
  }

  gt.circleCircleIntersect = function(circleX1, circleY1, radius1, circleX2, circleY2, radius2) {
    const dx = circleX2 - circleX1;
    const dy = circleY2 - circleY1;
    const distanceSquared = dx * dx + dy * dy;
    const combinedRadius = radius1 + radius2;

    if (distanceSquared <= combinedRadius * combinedRadius) {
      if (distanceSquared === 0) return { x: circleX1, y: circleY1 };
      const distance = Math.sqrt(distanceSquared);
      const t = radius1 / distance;
      const hitX = circleX1 + dx * t;
      const hitY = circleY1 + dy * t;
      return { x: hitX, y: hitY };
    }
    return null;
  }

  gt.getRectCornersFromCenter = function(centerX, centerY, width, height, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const halfW = width / 2;
    const halfH = height / 2;
    return [
      { x: centerX + (-halfW * cosA - halfH * sinA), y: centerY + (-halfW * sinA + halfH * cosA) },
      { x: centerX + (halfW * cosA - halfH * sinA), y: centerY + (halfW * sinA + halfH * cosA) },
      { x: centerX + (halfW * cosA + halfH * sinA), y: centerY + (halfW * sinA - halfH * cosA) },
      { x: centerX + (-halfW * cosA + halfH * sinA), y: centerY + (-halfW * sinA - halfH * cosA) }
    ];
  }

  gt.rectRectIntersect = function(rect1Corners, rect2Corners) {
    const hits = [];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const hit = lineLineIntersect(
          rect1Corners[i].x, rect1Corners[i].y, rect1Corners[(i + 1) % 4].x, rect1Corners[(i + 1) % 4].y,
          rect2Corners[j].x, rect2Corners[j].y, rect2Corners[(j + 1) % 4].x, rect2Corners[(j + 1) % 4].y
        );
        if (hit) hits.push(hit);
      }
    }

    if (hits.length === 0) return null;

    const avgX = hits.reduce((sum, hit) => sum + hit.x, 0) / hits.length;
    const avgY = hits.reduce((sum, hit) => sum + hit.y, 0) / hits.length;
    return { x: avgX, y: avgY };
  }

  gt.calculateClosingSpeedAndAngle = function(car, target) {
    const carVelocityX = Math.cos(car.angle) * car.currentSpeed;
    const carVelocityY = Math.sin(car.angle) * car.currentSpeed;

    let targetX, targetY, targetVelocityX = 0, targetVelocityY = 0;

    if (target.hitX !== undefined && target.hitY !== undefined) {
      targetX = target.hitX;
      targetY = target.hitY;
    } else if (target.x !== undefined && target.y !== undefined) {
      targetX = target.x;
      targetY = target.y;
      if (target.currentSpeed !== undefined && target.angle !== undefined) {
        targetVelocityX = Math.cos(target.angle) * target.currentSpeed;
        targetVelocityY = Math.sin(target.angle) * target.currentSpeed;
      }
    }

    const angleToTarget = Math.atan2(targetY - car.y, targetX - car.x);
    const relVelocityX = carVelocityX - targetVelocityX;
    const relVelocityY = carVelocityY - targetVelocityY;
    const closingSpeed = relVelocityX * Math.cos(angleToTarget) + relVelocityY * Math.sin(angleToTarget);

    const distance = Math.hypot(targetX - car.x, targetY - car.y);

    const timeToC = closingSpeed > 0 ? distance / closingSpeed : Infinity;

    return { closingSpeed, angle: angleToTarget, distance, timeToC };
  }

  gt.toHexRGB = function(color) {
    const originalStyle = ctx.fillStyle;
    ctx.fillStyle = color;
    const hex = ctx.fillStyle.toUpperCase().slice(0, 7);
    ctx.fillStyle = originalStyle;
    return hex;
  }

  gt.adjustRGBA = function(color, amount) {
    const isHex = color.startsWith('#');
    const a = isHex && color.length > 7 ? color.slice(7) : '';
    const rgbHex = isHex ? color.slice(0, 7) : toHexRGB(color, ctx);
    const rgb = [1, 3, 5].map(i => parseInt(rgbHex.slice(i, i + 2), 16));
    let [h, s, l] = rgbToHsl(...rgb);
    l = Math.max(0, Math.min(100, l * amount));
    return `#${hslToRgb(h, s, l).map(x => x.toString(16).padStart(2, '0')).join('')}${a}`;
  }

  gt.hslToRgb = function(h, s, l) {
    s /= 100, l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, hPrime = h / 60, x = c * (1 - Math.abs(hPrime % 2 - 1)), m = l - c / 2;
    let r, g, b;
    [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hPrime)] || [0, 0, 0];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  gt.rgbToHsl = function(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, max, g, b), d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }

  gt.clamp = function(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

let tableMinWH=800;
let tableMaxWH=1200;
let toTable=1;
let tableWidth, tableHeight;
let tableCenterX, tableCenterY;
let tableAspRat;
let tableLayout;

{  // cavnas fullscreen
gt.onMobile = /Mobi|Android/i.test(navigator.userAgent);

function resizeCanvas() {
  // const dpr = window.devicePixelRatio || 1;
  // canvas.width = window.innerWidth * dpr;
  // canvas.height = window.innerHeight * dpr;
  // canvas.style.width = window.innerWidth + 'px';
  // canvas.style.height = window.innerHeight + 'px';
  // ctx.scale(dpr, dpr);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';  
  
  toTable = (
    (canvas.width / clamp(canvas.width, tableMinWH, tableMaxWH)) + 
    (canvas.height / clamp(canvas.height, tableMinWH, tableMaxWH)) ) / 2;
  
  if( toTable!=1 ){
    ctx.scale(toTable, toTable);
  }
  tableWidth = canvas.width / toTable;
  tableHeight = canvas.height / toTable;
  
  tableCenterX = tableWidth/2;
  tableCenterY = tableHeight/2;
  
  tableAspRat = tableWidth / tableHeight;
  
  tableLayout = tableWidth>tableHeight ? 'l' : 'p';
  
  pauseTriggersLayout();
  pauseMenuLayout();
  if( diceBag && diceBag.diceSet ){
    diceBag.diceSet.layout();
  }
}
window.addEventListener('resize', resizeCanvas);

// mobileFullScreen = function(e) {
  // try {
    // e.target.requestFullscreen();
    // canvas.removeEventListener('touchend', mobileFullScreen);
  // } catch (err) {
    // console.error("Fullscreen error:", err);
  // }
// }
// canvas.addEventListener('touchend', mobileFullScreen );
}

function pauseGame() {
  if( gameState.state == 'running' ){
    gameState.state = 'paused';
    
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }        
      }      
    } catch (err) {  }
      
    saveGame();    
  }
}
function resumeGame() {
  gameState.state = 'running'; 
  if ( onMobile && !document.fullscreenElement && !document.webkitFullscreenElement) {
    try {
      if (canvas.requestFullscreen) {
        canvas.requestFullscreen();
      } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen();
      }
      resizeCanvas(); // Adjust canvas after fullscreen
    } catch (err) {
      console.error("Fullscreen restoration error:", err);
    }
  }
}

document.addEventListener('visibilitychange', (e) => {
  e.preventDefault()
  e.stopPropagation();
  if (document.visibilityState === 'hidden') {
    pauseGame();
  } else if (document.visibilityState === 'visible') {
    
  }
});
window.addEventListener('blur', pauseGame);
//window.addEventListener('focus', resumeGame);

class Dice {
  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.z = .5;
    this.speed = 0;
    this.direction = 0;
    this.zSpeed = 0;
    this.zGravity = 12;
    this.color = config.color || 'white';
    this.faces = config.faces || ['1', '2', '3', '4', '5', '6'];
    this.faceColor = config.faceColor || 'black';
    this.strokeColor = config.strokeColor;
    this.rollFrame = 0;
    this.rollSpeed = 0;
    this.size = Dice_Size;
    this.isStopped = false;
    this.sideLocked = false;
    this.stoppedCallback = config.stoppedCallback
      ? config.stoppedCallback.bind(this) 
      : (() => {});
    this.rotation = 0;
    this.rotationSpeed = 0;    
    this.currentSide = 0;
    this.nextSide = 1;
    this.totalWidth = this.size;
    this.zScale = 1 + this.z / 3;
    this.held = null;
    this.onSpot = null;
    this.lastX = x;
    this.lastY = y;
    this.actualSpeed = 0;
    this.actualDirection = 0;
    this.visible = true;
  }
  
  pickUp(touchId){
    //table spots override being held by hand
    if( !(this.held instanceof TableSpot) ){
      this.held = "t-"+touchId;
    }

    if( !this.sideLocked ){
      const indices = Array.from({ length: this.faces.length }, (_, i) => i);
      const shuffledIndices = shuffleArray(indices);
      this.faces = shuffledIndices.map(i => this.faces[i]);
      
      this.rotation = Math.random()*PI*2;
      this.rotationSpeed = 2 * (Math.random() > 0.5 ? 1 : -1);  
      this.rollSpeed = 1.8+Math.random()*.4;
    }
    this.z = .4+Math.random()*.2;
    this.isStopped = false;
  }
  
  setSpeedDirection(speed, direction) {
    if( this.sideLocked ){  speed=0; }
    this.speed = speed;
    this.direction = direction;
    if (!this.sideLocked) {
      const newRollSpeed = this.speed / 300 + (3 + Math.random() * 1);
      this.rollSpeed = Math.max( this.rollSpeed, newRollSpeed );
      //this.rollFrame = Math.random()*.5;
    }    
    
    const newRotSpeed = this.speed / 300 * (1 + Math.random() * 0.2);
    this.rotationSpeed = Math.abs(newRotSpeed)> Math.abs(this.rotationSpeed) ? newRotSpeed : this.rotationSpeed;
    
    if( !this.sideLocked ){
      this.zSpeed = (1+Math.min(1,this.speed/500)+Math.random()*1)      
      this.z += .5;
      this.isStopped = false;
    }else{    
      this.zGravity/30;
      this.isStopped = true;
    }
  }

  update(deltaTime, allDice) {
    if( !this.visible ){  return;  }
    
    let needPush = false;
    let distance, nx, ny;
      
    if ( this.onSpot && !this.held && !this.onSpot.isPointInside(this.x, this.y) ) {
      needPush = true;      

      const dx = this.onSpot.x - this.x;
      const dy = this.onSpot.y - this.y;
      distance = Math.hypot(dx, dy);
      
      const angleOffset = Math.min(Math.PI / 10, distance * 0.01);

      const onx = dx / distance;
      const ony = dy / distance;
      const cosA = Math.cos(angleOffset);
      const sinA = Math.sin(angleOffset);
      nx = onx * cosA - ony * sinA;
      ny = onx * sinA + ony * cosA;
    }
    
    if ( this.isStopped && !this.onSpot) {
      for (let spot of tableSpots) {
        if (spot.enabled && spot.isPointInside(this.x, this.y)) {
          needPush = true;

          const dx = this.x - spot.x;
          const dy = this.y - spot.y;
          distance = Math.max(0.1, Math.hypot(dx, dy));
          nx = dx / distance;
          ny = dy / distance;
          
          // go toward center if the spot isn't in center
          if ( ! spot.isPointInside(tableCenterX, tableCenterY)) {                      
            const dxCenter = tableCenterX - this.x;
            const dyCenter = tableCenterY - this.y;
            const distanceCenter = Math.max(0.1, Math.hypot(dxCenter, dyCenter));
            const centerDirection = Math.atan2(dyCenter, dxCenter);

            const pushAngle = Math.atan2(ny, nx);

            if (Math.abs(pushAngle - centerDirection) > Math.PI*.4) {
              nx = Math.cos(centerDirection);
              ny = Math.sin(centerDirection);
            }
          }
          
          //flip distance for more speed closer to center
          const maxDistance = spot.shape === 'circle'
            ? spot.diameter / 2
            : Math.hypot(spot.width, spot.height) / 2;

          distance = 2 + maxDistance - distance;
          
          break;
        }
      }
    }
    
    if( needPush ) {
      const PULL_STRENGTH = 90;
      const DAMPING = 0.8; //lower is more
      
      const force = PULL_STRENGTH * distance;
      const fx = nx * force;
      const fy = ny * force;

      const velocityX = Math.cos(this.direction) * this.speed;
      const velocityY = Math.sin(this.direction) * this.speed;

      const newVelocityX = (velocityX + fx * deltaTime) * DAMPING;
      const newVelocityY = (velocityY + fy * deltaTime) * DAMPING;

      this.speed = Math.hypot(newVelocityX, newVelocityY);
      this.direction = Math.atan2(newVelocityY, newVelocityX);
    }
    
    // Update z position if not held
    if (!this.held) {
      this.z = Math.min( MAX_Z_HEIGHT, this.z + this.zSpeed * deltaTime);
      if (this.z > 0) {
        //above ground gravity
        this.zSpeed -= this.zGravity * deltaTime;
      } else if (this.z < 0) {
        this.z = 0;
        this.zSpeed = -this.zSpeed * (this.sideLocked ? 0.2 : 0.6);
        if (Math.abs(this.zSpeed) < 1) this.zSpeed = 0;
      } else {
        this.speed *= 0.93;
        this.rotationSpeed *= 0.94;
      }
      
      this.speed *= 0.99;
      this.rotationSpeed *= 0.995;
      
      if( this.sideLocked ){
        this.speed *= 0.9;
        this.rotationSpeed *= 0.9;
      }
    }
    
    // Check landing condition
    const landed = this.z < 0.15 && Math.abs(this.zSpeed) < 0.8;
    const keepRolling = !landed || this.rollFrame > 0;

    // Stop if slow
    if (this.speed < 1 ){      
      this.speed=0;
      if( !keepRolling && !this.held && !this.isStopped ) {
        this.stopRoll();      
      }
    }

    // Store previous position and velocity
    const velocityX = Math.cos(this.direction) * this.speed;
    const velocityY = Math.sin(this.direction) * this.speed;

    // Update position if not held
    if (!this.held) {
      this.x += velocityX * deltaTime;
      this.y += velocityY * deltaTime;
    }
    
    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    this.actualSpeed = Math.min( Math.hypot(dx, dy) / deltaTime, Max_SPEED);
    this.actualDirection = Math.atan2(dy, dx);
    if(this.actualSpeed<this.speed )
    {
      this.actualSpeed = this.speed;
      this.actualDirection = this.direction;
    }
    this.lastX = this.x;
    this.lastY = this.y;
    
    const restitution = 0.8;
    const wallRestitution = 0.8;

    // Wall collisions (apply even if held to keep dice on screen)
    const edgeBuffer = this.held ? this.size/2 : this.size;
    if (this.x < edgeBuffer || this.x > tableWidth - edgeBuffer) {
      const newVelocityX = -velocityX * wallRestitution;
      const newVelocityY = velocityY * wallRestitution;
      this.speed = Math.hypot(newVelocityX, newVelocityY);
      this.direction = Math.atan2(newVelocityY, newVelocityX);
      this.x = Math.max(edgeBuffer, Math.min(tableWidth - edgeBuffer, this.x));
      this.zSpeed = Math.min( this.zSpeed+.01, Max_Z_SPEED);
    }
    if (this.y < edgeBuffer || this.y > tableHeight - edgeBuffer) {
      const newVelocityX = velocityX * wallRestitution;
      const newVelocityY = -velocityY * wallRestitution;
      this.speed = Math.hypot(newVelocityX, newVelocityY);
      this.direction = Math.atan2(newVelocityY, newVelocityX);
      this.y = Math.max(edgeBuffer, Math.min(tableHeight - edgeBuffer, this.y));      
      this.zSpeed = Math.min( this.zSpeed+.01, Max_Z_SPEED);
    }
    
    // TableSpot boundary collisions for walled spots
    if (this.onSpot && this.onSpot.walled && !this.held) {
      if (this.onSpot.shape === 'circle') {
        const dx = this.x - this.onSpot.x;
        const dy = this.y - this.onSpot.y;
        const distance = Math.hypot(dx, dy);
        const radius = this.onSpot.diameter / 2 - this.size / 2;
        if (distance > radius) {
          const normalX = dx / distance;
          const normalY = dy / distance;
          const dot = velocityX * normalX + velocityY * normalY;
          const newVelocityX = velocityX - 2 * dot * normalX;
          const newVelocityY = velocityY - 2 * dot * normalY;
          this.speed = Math.hypot(newVelocityX, newVelocityY) * wallRestitution;
          this.direction = Math.atan2(newVelocityY, newVelocityX);
          this.x = this.onSpot.x + normalX * radius;
          this.y = this.onSpot.y + normalY * radius;
          this.zSpeed = Math.min(this.zSpeed + 0.01, Max_Z_SPEED);
        }
      } else {
        const corners = gt.getRectCornersFromCenter(this.onSpot.x, this.onSpot.y, this.onSpot.width, this.onSpot.height, 0);
        const bounds = this.getBounds(corners);
        const edgeBuffer = this.size / 2;
        if (this.x < bounds.minX + edgeBuffer || this.x > bounds.maxX - edgeBuffer) {
          const newVelocityX = -velocityX * wallRestitution;
          const newVelocityY = velocityY * wallRestitution;
          this.speed = Math.hypot(newVelocityX, newVelocityY);
          this.direction = Math.atan2(newVelocityY, newVelocityX);
          this.x = Math.max(bounds.minX + edgeBuffer, Math.min(bounds.maxX - edgeBuffer, this.x));
          this.zSpeed = Math.min(this.zSpeed + 0.01, Max_Z_SPEED);
        }
        if (this.y < bounds.minY + edgeBuffer || this.y > bounds.maxY - edgeBuffer) {
          const newVelocityX = velocityX * wallRestitution;
          const newVelocityY = -velocityY * wallRestitution;
          this.speed = Math.hypot(newVelocityX, newVelocityY);
          this.direction = Math.atan2(newVelocityY, newVelocityX);
          this.y = Math.max(bounds.minY + edgeBuffer, Math.min(bounds.maxY - edgeBuffer, this.y));
          this.zSpeed = Math.min(this.zSpeed + 0.01, Max_Z_SPEED);
        }
      }
    }

    // Collision with other dice
    for (let other of allDice) {
      if (other === this ) continue;
      const hit = this.hitDetect(other);  
      if (hit) {
        // Calculate collision normal
        let normalX = hit.normalX;
        let normalY = hit.normalY;
        const normalLength = Math.hypot(normalX, normalY);
        if (normalLength === 0) {
          normalX = Math.random() * 0.1 - 0.05;
          normalY = Math.random() * 0.1 - 0.05;
        } else {
          normalX /= normalLength;
          normalY /= normalLength;
        }

        // Push dice apart by 1px
        this.x += normalX * 1;
        this.y += normalY * 1;
        other.x -= normalX * 1;
        other.y -= normalY * 1;

        // Use actual velocities for collision response
        const velocityX = Math.cos(this.actualDirection) * this.actualSpeed;
        const velocityY = Math.sin(this.actualDirection) * this.actualSpeed;
        const otherVelocityX = Math.cos(other.actualDirection) * other.actualSpeed;
        const otherVelocityY = Math.sin(other.actualDirection) * other.actualSpeed;

        // Relative velocity
        const relVelocityX = velocityX - otherVelocityX;
        const relVelocityY = velocityY - otherVelocityY;

        // Dot product of relative velocity and normal
        const dot = relVelocityX * normalX + relVelocityY * normalY;

        // Handle collision for moving dice
        if (dot <= 0) {
          const restitution = 0.8;
          // Impulse scalar
          const impulse = -(1 + restitution) * dot / 2;

          // Apply impulse to velocities
          const newVelocityX = velocityX + impulse * normalX;
          const newVelocityY = velocityY + impulse * normalY;
          const otherNewVelocityX = otherVelocityX - impulse * normalX;
          const otherNewVelocityY = otherVelocityY - impulse * normalY;

          // Update this dice's speed and direction
          if( !this.held ){
            this.speed = Math.hypot(newVelocityX, newVelocityY);
            this.direction = Math.atan2(newVelocityY, newVelocityX);
            this.rotationSpeed += impulse / 3 * 0.01 * (Math.random() > 0.5 ? 1 : -1);
          }
          
          // Update other dice
          if ( !other.held ) {
            const newOtherSpeed = Math.hypot(otherNewVelocityX, otherNewVelocityY);
            const newOtherDirection = Math.atan2(otherNewVelocityY, otherNewVelocityX);
            if (other.isStopped && !other.sideLocked && !other.held && !this.sideLocked) {
              other.setSpeedDirection(newOtherSpeed, newOtherDirection);
            } else {          
              other.speed = newOtherSpeed;
              other.direction = newOtherDirection;
              other.rotationSpeed += impulse / 3 * 0.01 * (Math.random() > 0.5 ? 1 : -1);
            }
          }
        }

        // Apply z-hop 
        if (this.z < 0.5 && !this.sideLocked) {
          this.z = Math.max(0.2, this.z);
          this.zSpeed = Math.min(this.zSpeed + 0.6 * this.actualSpeed / 500, Max_Z_SPEED);
        }
        if (other.z < 0.5 && !other.sideLocked) {
          other.z = Math.max(0.2, other.z);
          other.zSpeed = Math.min(other.zSpeed + 0.6 * (other.actualSpeed * restitution + this.actualSpeed * 0.5) / 500, Max_Z_SPEED);
        }
      }
    }    

    // Update rollFrame
    if (keepRolling) {
      if (!landed) {
        if (!this.held) this.rollSpeed *= 0.98;
      } else {
        this.rollSpeed *= 1.04;
      }
      const rollSpeedDt = this.rollSpeed * deltaTime;
      this.rollFrame += rollSpeedDt;
    }
    if (this.rollFrame > 1) {
      if (!landed) {
        this.rollFrame -= 1;
      } else {
        this.rollFrame = 0;
      }
      this.currentSide = this.nextSide;
      this.nextSide = (this.currentSide + 1) % this.faces.length;
    }

    // Update rotation
    this.rotation = (this.rotation + this.rotationSpeed * deltaTime) % (PI * 2);
  }
  
  stopRoll(andCallback=true) {
    this.speed = 0;    
    this.z = 0;
    this.rotationSpeed = 0;
    this.rollSpeed = 0;
    this.rollFrame = 0;
    this.isStopped = true;
    if( andCallback===true ){
      this.stoppedCallback();      
    }
  }
  
  getFace(){
    return faces[currentSide];
  }
  
  draw() {
    if( !this.visible ){  return;  }
    
    this.zScale = 1 + this.z / 4;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.zScale, this.zScale);

    const rollAngle = this.rollFrame * PI / 2;
    const currentSideScale = Math.abs(Math.cos(rollAngle));
    const nextSideScale = Math.abs(Math.sin(rollAngle));
    this.totalWidth = this.size * (currentSideScale + nextSideScale);

    const curSideRatio = currentSideScale / (currentSideScale + nextSideScale);
    const nextSideRatio = 1 - curSideRatio;

    // Current side
    this.drawSide(this.faces[this.currentSide], -this.totalWidth / 2 * nextSideRatio, currentSideScale);

    // Next side
    this.drawSide(this.faces[this.nextSide], this.totalWidth / 2 * curSideRatio, nextSideScale);

    ctx.restore();
  }

  drawAsIcon(scale = 1) {
    ctx.save();
    ctx.scale(scale, scale);
    this.zScale = 1; // No z effect for icon
    this.totalWidth = this.size; // Fixed width, no roll effect

    ctx.translate(0, 0);
    this.drawSide(this.faces[this.currentSide], 0, 1);

    ctx.restore();
  }
  
  drawSide(face, offsetX, scaleX) {
    if( scaleX<=0 ){  return;  }
    
    ctx.save();
    ctx.translate(offsetX, 0);
    ctx.scale(scaleX, 1);

    // Background
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.strokeStyle = 'grey';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);

    this.drawFace(face);

    ctx.restore();
  }

  drawFace(face) {
    const parts = face.split('-');
    const pattern = parts[0] || '1';
    let shape = parts[1] || 'circle';
    let shapeColor = parts[2] || this.faceColor;
    const sizeMod = parseFloat(parts[3]) || parseFloat(parts[2]) || 1;
    const shapeSize = (this.size / 5) * sizeMod;
    const offset = this.size / 4;
    const halfOffset = offset / 2;

    const patterns = {
      '0': [],
      '1': [{ x: 0, y: 0 }],
      '2': [{ x: -offset, y: -offset }, { x: offset, y: offset }],
      '2t': [{ x: -halfOffset, y: -halfOffset }, { x: halfOffset, y: halfOffset }],
      '2b': [{ x: -offset, y: 0 }, { x: offset, y: 0 }],
      '3': [{ x: -offset, y: -offset }, { x: 0, y: 0 }, { x: offset, y: offset }],
      '3b': [{ x: 0, y: -halfOffset }, { x: 0, y: 0 }, { x: 0, y: halfOffset }],
      '3t': [{ x: -halfOffset, y: -halfOffset }, { x: 0, y: halfOffset }, { x: halfOffset, y: -halfOffset }],
      '4': [{ x: -offset, y: -offset }, { x: -offset, y: offset }, { x: offset, y: -offset }, { x: offset, y: offset }],
      '5': [{ x: -offset, y: -offset }, { x: -offset, y: offset }, { x: 0, y: 0 }, { x: offset, y: -offset }, { x: offset, y: offset }],
      '6': [
        { x: -offset, y: -offset }, { x: -offset, y: 0 }, { x: -offset, y: offset },
        { x: offset, y: -offset }, { x: offset, y: 0 }, { x: offset, y: offset }
      ],
      '7': [
        { x: -offset, y: -offset }, { x: -offset, y: 0 }, { x: -offset, y: offset },
        { x: 0, y: 0 },
        { x: offset, y: -offset }, { x: offset, y: 0 }, { x: offset, y: offset }
      ],
      '8': [
        { x: -offset, y: -offset }, { x: -offset, y: offset }, { x: offset, y: -offset }, { x: offset, y: offset },
        { x: 0, y: -offset }, { x: 0, y: offset }, { x: -halfOffset, y: 0 }, { x: halfOffset, y: 0 }
      ],
      '9': [
        { x: -offset, y: -offset }, { x: -offset, y: 0 }, { x: -offset, y: offset },
        { x: 0, y: -offset }, { x: 0, y: 0 }, { x: 0, y: offset },
        { x: offset, y: -offset }, { x: offset, y: 0 }, { x: offset, y: offset }
      ]
    };

    if (patterns[pattern]) {
      patterns[pattern].forEach(pos => {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        //ctx.fillStyle = adjustRGBA(shapeColor, .4);
        //ctx.lineWidth = 2;
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.strokeColor!=undefined ? this.strokeColor : adjustRGBA(shapeColor, .5);
        //ctx.strokeStyle = '#00000000';
        ctx.fillStyle = shapeColor;
        drawShape(shape, shapeSize);
        // ctx.fillStyle = adjustRGBA(shapeColor, .8);
        // drawShape(shape, shapeSize - 1);
        // ctx.fillStyle = shapeColor;
        // drawShape(shape, shapeSize - 3);
        ctx.restore();
      });
    }
  }
  
  getCorners() {
    return gt.getRectCornersFromCenter(this.x, this.y, this.totalWidth * this.zScale, this.size * this.zScale, this.rotation);
  }
  
  getBounds(corners) {
    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  hitDetect(otherDie) {
    const rect1Corners = this.getCorners();
    const rect2Corners = otherDie.getCorners();

    const edgeHit = gt.rectRectIntersect(rect1Corners, rect2Corners);

    const isPointInside = (point, corners) => {
      return gt.pointInRect(point.x, point.y, corners);
    };

    let contained = false;
    for (let corner of rect1Corners) {
      if (isPointInside(corner, rect2Corners)) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      for (let corner of rect2Corners) {
        if (isPointInside(corner, rect1Corners)) {
          contained = true;
          break;
        }
      }
    }

    if (contained || edgeHit) {
      const getBounds = (corners) => {
        const xs = corners.map(c => c.x);
        const ys = corners.map(c => c.y);
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        };
      };
      const bounds1 = getBounds(rect1Corners);
      const bounds2 = getBounds(rect2Corners);

      const overlapX = Math.min(bounds1.maxX, bounds2.maxX) - Math.max(bounds1.minX, bounds2.minX);
      const overlapY = Math.min(bounds1.maxY, bounds2.maxY) - Math.max(bounds1.minY, bounds2.minY);

      // Find the minimum translation vector
      let normalX, normalY;
      if (overlapX < overlapY) {
        normalX = bounds1.minX < bounds2.minX ? -1 : 1;
        normalY = 0;
      } else {
        normalX = 0;
        normalY = bounds1.minY < bounds2.minY ? -1 : 1;
      }

      const hitX = (Math.max(bounds1.minX, bounds2.minX) + Math.min(bounds1.maxX, bounds2.maxX)) / 2;
      const hitY = (Math.max(bounds1.minY, bounds2.minY) + Math.min(bounds1.maxY, bounds2.maxY)) / 2;

      return { x: hitX, y: hitY, normalX, normalY };
    }

    return null;
  };

  toSave() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      speed: this.speed,
      direction: this.direction,
      zSpeed: this.zSpeed,
      rotation: this.rotation,
      rollFrame: this.rollFrame,
      rollSpeed: this.rollSpeed,
      faces: this.faces,
      color: this.color,
      faceColor: this.faceColor,
      strokeColor: this.strokeColor,
      currentSide: this.currentSide,
      sideLocked: this.sideLocked,
      isStopped:  this.isStopped,
      visible: this.visible
    };
  }

  setFromSave(config) {
    this.x = config.x;
    this.y = config.y;
    this.z = config.z;
    this.speed = config.speed;
    this.direction = config.direction;
    this.zSpeed = config.zSpeed;
    this.rotation = config.rotation;
    this.rollFrame = config.rollFrame;
    this.rollSpeed = config.rollSpeed;
    this.faces = config.faces;
    this.color = config.color;
    this.faceColor = config.faceColor;
    this.strokeColor = config.strokeColor;
    this.currentSide = config.currentSide;
    this.sideLocked = config.sideLocked;
    this.nextSide = (this.currentSide + 1) % this.faces.length;    
    this.isStopped = config.isStopped;
    this.visible = config.visible;
  }
}

{  // dice configs
gt.Dice_Size=60;
gt.Max_SPEED=1500;
gt.GROUP_DICE_SLOW=.1;
gt.Max_Z_SPEED=2;
gt.MAX_Z_HEIGHT=3;

gt.diceColors = [
  '#EEEEEE', // White
  '#111111', // Black
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#008000', // Dark Green
  '#FFD700', // Gold
  '#A52A2A'  // Brown
];

gt.faceShapes = [
  'circle', 'star', 'square', 'triangle', 'pentagon', 'cross', 'diamond','X','O'
];

gt.diceConfigs = [
  {
    name: 'standard 6',
    faces: [
      '1-circle',
      '2-circle',
      '3-circle',
      '4-circle',
      '5-circle',
      '6-circle'      
    ],
    color: '#ffffff',
    faceColor: '#000099'
  },
  {
    name: 'standard 9',
    faces: [
      '1-circle',
      '2-circle',
      '3-circle',
      '4-circle',
      '5-circle',
      '6-circle',
      '7-circle',
      '8-circle',
      '9-circle',
    ],
    color: '#ffffff',
    faceColor: '#00cc00'
  },
  {
    name: 'lucky13-easy',
    faces: [
      '1-doubleO-#33ff33-3.5',
      '1-doubleO-#33ff33-3.5',
      '1-doubleO-#33ff33-3.5',
      '3t-circle-#33ff33-.6',
      '3t-circle-#33ff33-.6',
      '1-X-#33ff33-3.4'
    ],
    color: '#222222',
    faceColor: '#33ff33'
  },
  {
    name: 'lucky13-med',
    faces: [
      '1-doubleO-#ffff00-3.5',
      '1-doubleO-#ffff00-3.5',
      '3t-circle-#ffff00-.6',
      '3t-circle-#ffff00-.6',
      '1-X-#ffff00-3.4',
      '1-X-#ffff00-3.4'
    ],
    color: '#222222',
    faceColor: '#ffff00'
  },
  {
    name: 'lucky13-hard',
    faces: [
      '1-doubleO-#ff0000-3.5',
      '3t-circle-#ff0000-.6',
      '3t-circle-#ff0000-.6',
      '1-X-#ff0000-3.4',
      '1-X-#ff0000-3.4',
      '1-X-#ff0000-3.4'
    ],
    color: '#222222',
    faceColor: '#ff0000'
  },
  {
    name: 'tester',
    faces: [
      '1-bat-#00cc00-3.5',
      '0',
      '2t-bat-#00cc00-2',
      '3t-bat',
      '1-bball-#33ff33-3.5',
    ],
    color: '#ffffff',
    faceColor: '#000099'
  },
  {
    name: 'bball-hit-nom',
    faces: [
      '1-bat-#D2B48C-3.5',
      '1-bat-#D2B48C-3.5',
      '1-bat-#D2B48C-3.5',
      '2t-bat-#D2B48C-2.2',
      '0',
      '0'
    ],
    color: '#555566',
    faceColor: '#33ff33'
  },
  {
    name: 'bball-hit-good',
    faces: [
      '1-bat-#D2B48C-3.5',
      '1-bat-#D2B48C-3.5',
      '2t-bat-#D2B48C-2.2',
      '2t-bat-#D2B48C-2.2',
      '0',
      '0'
    ],
    color: '#555599',
    faceColor: '#33ff33'
  },
  {
    name: 'bball-pitch-nom',
    faces: [
      '1-bball-#ff6666-3.5',
      '1-bball-#ff6666-3.5',
      '1-bball-#ff6666-3.5',
      '2t-bball-#ff6666-2.2',
      '0',
      '0'
    ],
    color: '#555566',
    faceColor: '#33ff33'
  },
  {
    name: 'bball-pitch-good',
    faces: [
      '1-bball-#ff6666-3.5',
      '1-bball-#ff6666-3.5',
      '2t-bball-#ff6666-2.2',
      '2t-bball-#ff6666-2.2',
      '0',
      '0'
    ],
    color: '#555599',
    faceColor: '#33ff33'
  },
  // {
    // name: 'mixed',
    // faces: [
      // '1-star-#ff9999-2',
      // '1-cross-green-2',
      // '2b-pentagon-#3399cc-1.2',
      // '4-square--1',
      // '5-triangle-magenta',
      // '6-diamond-cyan'
    // ],
    // color: '#cc3333',
    // faceColor: '#FFFFFF'
  // },
  // {
    // name: 'stars',
    // faces: [
      // '1-circle-red-2',
      // '2-circle-purple',
      // '3-star-blue',
      // '4-star-green',
      // '5-star-brown',
      // '6-star-pink'
    // ],
    // color: '#ffaa00',
    // faceColor: '#FFFFFF'
  // },
  // {
    // name: 'shapes',
    // faces: [
      // '6-circle',
      // '6-star',
      // '6-square',
      // '6-triangle',
      // '6-pentagon',
      // '6-cross',
      // '6-diamond'
    // ],
    // color: '#eeeeee',
    // faceColor: '#aa1111'
  // },
  {
    name: 'suits',
    generate: (config) => {
      const start = config?.numStart !== undefined ? config.numStart : Math.floor(Math.random() * 4) + 1;
      const suitIndex = config?.suitIndex !== undefined ? config.suitIndex : Math.floor(Math.random() * 4);
      const patterns = Array.from({ length: 6 }, (_, i) => ((i + start - 1) % 9 + 1).toString());
      const suits = ['heart', 'diamond', 'club', 'spade'];
      return {
        faces: patterns.map(p => `${p}-${suits[suitIndex]}`),
        color: '#eeeeee',
        faceColor: suitIndex < 2 ? '#ff3333' : '#666677'
      };
    }
  },
  {
    name: 'randomShapes',
    generate: () => {
      const shape = faceShapes[Math.floor(Math.random() * faceShapes.length)];
      const numFaces = Math.floor(Math.random() * 4) + 3; // 3 to 6 faces
      const patterns = Array.from({ length: numFaces }, (_, i) => (i + 1).toString());
      const color = diceColors[Math.floor(Math.random() * diceColors.length)];
      return {
        faces: patterns.map(p => `${p}-${shape}-${color}`),
        color: diceColors[Math.floor(Math.random() * diceColors.length)],
        faceColor: '#222222'
      };
    }
  }
];

gamesList = [ {
  name: 'Lucky 13',
  class: 'Lucky13',
  titleDraw: {
    bg: '#666699'
  }
},{
  name: 'Any Roll',
  class: 'AnyRoll',
  titleDraw: {
    bg: '#448844'
  }
},{
  name: 'Poker',
  class: 'Poker',
  titleDraw: {
    bg: '#447744'
  }
},{
  name: 'Baseball',
  class: 'Baseball',
  titleDraw: {
    bg: '#00aa33'
  }
},{
  name: 'Arena',
  class: 'Arena',
  titleDraw: {
    bg: '#aa3300'
  }
}
];

const diceSets = [ 'Lucky13', 'SuitsAll','Poker','AnyRoll'];
gt.DiceSet = class DiceSet {
  constructor() {
    this.name = this.constructor.name;
    this.autoRefill = false;
    this.emptyOnRefill = false;
    this.reuseUnlocked = false;
    this.dicePerThrow = 1;
    this.multiThrows=false;
    this.playerCount = 0;  
    
    this.diceConfigs = [];
  }

  init() {
    if( this.BG_FILL ){ BG_FILL = this.BG_FILL; }
  }

  layout() { }

  drawBg() { }
  
  drawFg() { }
  
  setDiceConfigs( rawConfigs = [] ) {
   for (const diceParam of rawConfigs) {
    let configTemplate = (typeof diceParam.config === 'string')
        ? diceConfigs.find(c => c.name === diceParam.config) 
        : diceParam.config;
      if (!configTemplate) continue;
      const config = configTemplate.generate 
        ? configTemplate.generate(diceParam.generateParams) 
        : configTemplate;
      config.stoppedCallback = this.stoppedCallback;
      this.diceConfigs.push({
        config: config,
        count: diceParam.count,
        generateParams: diceParam.generateParams
      });
    }
  }

  preRollCallBack() { }
  
  stoppedCallback() { }
  
  allStoppedCallback() { }
  
  dropCallback() { }
  
  toSave() {
    return {};
  }
  
  setFromSave(config) {}
}

gt.Lucky13 = class Lucky13 extends DiceSet {
  constructor() {
    super();
    this.emptyOnRefill = true;
    this.reuseUnlocked = true;
    this.dicePerThrow = 3; 
    this.winningScore = 13;
    this.playerCount = 2;
    this.BG_FILL = '#666699';

    this.setDiceConfigs([
      { config: 'lucky13-easy', count: 6 },
      { config: 'lucky13-med', count: 4 },
      { config: 'lucky13-hard', count: 3 }
    ]);
  }

  init() {
    super.init();    
    const spotConfig = {
      shape: 'rect',
      bgColor: '#00000011',
      borderColor: '#99999933',
      borderWidth: 3,
      borderType: 'solid',
      titleColor: '#ffffff66',
      titleFont: '44px Thin'      
    };
    gt.strikeSpot = new TableSpot({
      ...spotConfig,      
      title: 'STRIKES'      
    });
    tableSpots.push( strikeSpot );
    gt.pointSpot = new TableSpot({
      ...spotConfig,      
      title: 'POINTS'
    });
    tableSpots.push( pointSpot );
    gt.takeScoreSpot = new TableSpot({
      enabled:false,      
      shape: 'circle',      
      bgColor: '#ffffff33',
      pressedBgColor: '#ffff6644',
      borderColor: '#eeeeee66',
      borderWidth: 2,
      borderType: 'solid',
      title: 'TAKE\nIT\n',
      titleColor: '#ffffff99',
      titleFont: '34px Thin',
      onTapCallback: this.takeScore.bind(this)
    });
    tableSpots.push( takeScoreSpot );
    
    this.layout()
  }
  
  layout() {
    const spacing = (tableWidth - 480) / 3;
    const edge = Dice_Size*.9;
    
    strikeSpot.width = 240;
    strikeSpot.height = 160;
    strikeSpot.x = spacing + 240 / 2;
    strikeSpot.y = Math.ceil(edge + strikeSpot.height/2);
    
    pointSpot.width = 240;
    pointSpot.height = 180;
    pointSpot.x = spacing*2 + 240 + 240 / 2;
    pointSpot.y =  Math.ceil(edge + pointSpot.height/2);
    
      
    takeScoreSpot.x = tableWidth / 2;
    takeScoreSpot.y = tableHeight -15;
    takeScoreSpot.diameter = 200;
    takeScoreSpot.radius = 20;
  }
  
  reset() {
    takeScoreSpot.enabled = false;
    dice.length = 0;
    diceBag.refill();
    this.dicePerThrow = 3;    
  }
  
  takeScore() {
    const newPoints = dice.filter(d => d.faces[d.currentSide].includes('O')).length;
    const curPlayer = players.getCurrentPlayer();
    const newScore = curPlayer.score + newPoints;
    const gameOver = newScore >= this.winningScore;
    
    diceBag.rollLock=true;
    
    const takePointsPu = new gt.TextPopupAct({
      text: `Takes ${newPoints}\nPoints`,
      x: tableWidth / 2,
      y: tableHeight / 2,
      font: '40px Normal',
      color: '#33ff33',
      holdDuration: .3,
      fadeDuration: 1,
      fadeScale: 1.008
    });
    
    const scoreAct = new gt.ScoreAndNextTurnAct({
      newScore: newScore,
      endGame: gameOver,
      winningPlayer: gameOver ? players.currentPlayerIndex : undefined
    });    
    
    const resetAct = new gt.Action(() => {
      if( gameOver ){
        players.drawMode = 'full';
      } else {
        this.reset();
      }
      return true;
    });

    takePointsPu.addNextAct(scoreAct);
    scoreAct.addNextAct(resetAct);    
    
    if( gameOver ) {
      resetAct.addNextAct( new gt.TextPopupAct({
          text: `${curPlayer.name}\n is the\nWinner!`,
          x: tableWidth / 2,
          y: tableHeight / 2,
          font: '50px Normal',
          color: '#33ff33',
          holdDuration: 0,
          fadeDuration: 2,
          fadeScale: 1.008
      }) );
    }
    
    addAction( takePointsPu );
  }
  
  preRollCallBack() {
    //unlock for reroll
    dice.filter(d => d.faces[d.currentSide].includes('-circle-'))
      .forEach(d => d.sideLocked = false);
    takeScoreSpot.enabled = false;
  }
  
  stoppedCallback() {
    this.sideLocked = true;
    const face = this.faces[this.currentSide];    
    if (face.includes('O')) {
      addAction( new MoveDiceAct({
        die: this,
        tableSpot: pointSpot
      }));        
    }else
    if (face.includes('X')) {
      addAction( new MoveDiceAct({
        die: this,
        tableSpot: strikeSpot
      }));        
    }
  }
  
  allStoppedCallback() {
    let xCount = 0;
    let oCount = 0;
    dice.forEach(die => {
      const face = die.faces[die.currentSide];
      if (face.includes('X')) xCount++;
      if (face.includes('O')) oCount++;
    });
    //3 strikes and your out
    if( xCount>=3 ){
      let strikeText = "3 Strikes\nYou're out!";      
      if( xCount==4 ){
        strikeText = "4 Strikes\nYou're really out!";
      }
      const curPlayer = players.getCurrentPlayer();
      let newScore = curPlayer.score;
      if(xCount>=5){
        strikeText = `${xCount} Strike\nSUPER OUT!\nLose a Point!`;
        newScore = Math.max(  newScore-1, 0 );
      }
      diceBag.rollLock=true;
      const strikeOutPu = new gt.TextPopupAct({
        text: strikeText,
        x: tableWidth / 2,
        y: tableHeight / 2,
        bounce: .1,
        font: '48px Normal',
        color: '#ff3333',
        holdDuration: 1,
        fadeDuration: 1.5        
      });
      strikeOutPu.addNextAct(new gt.Action(() => {
        this.reset();
        addAction( new gt.ScoreAndNextTurnAct({
          newScore: newScore
        }) );
        return true;
      }));
      addAction(strikeOutPu);
    }
    else{      
      //all quiet adds extra dice
      //const rethrowsLeft = dice.filter(d => !d.sideLocked && !d.held).length;
      const rethrowsLeft = dice.length - xCount - oCount;
      if( rethrowsLeft == this.dicePerThrow ) {
        this.dicePerThrow++;
        addAction( new gt.TextPopupAct({
          text: "boring\nadd another",
          x: tableWidth / 2,
          y: tableHeight / 2,
          font: '40px Normal',
          color: '#ffcc33',
          holdDuration: 0,
          fadeDuration: 1.25
        }) );
      }else{
        this.dicePerThrow = Math.max( rethrowsLeft, 3 );
      }
      //can always take points
      if( oCount>0 ){
        takeScoreSpot.title = 'TAKE\nIT\n\n',
        takeScoreSpot.enabled = true;
      }else
      if( xCount+this.dicePerThrow>=5 ){
        takeScoreSpot.title = 'GIVE\nUP\n',
        takeScoreSpot.enabled = true;
      }
    }
  }
  
  toSave() {
    return {
      dicePerThrow: this.dicePerThrow,
      takeScoreEnabled: takeScoreSpot.enabled,
      takeScoreSpotTitle : takeScoreSpot.title 
    };
  }

  setFromSave(config) {
    this.dicePerThrow = config.dicePerThrow || 3;
    takeScoreSpot.enabled = config.takeScoreEnabled;
    takeScoreSpot.title = config.takeScoreSpotTitle;
  }
}

gt.SuitsAll = class SuitsAll extends DiceSet {
  constructor() {
    super();
    this.dicePerThrow = 5;
    
    const suits = [0, 1, 2, 3]; // Heart, Diamond, Club, Spade
    const numStarts = [1, 2, 3, 4]; // all possible 1-6 to 4-9
    const rawConfigs = suits.flatMap(suiti =>
      numStarts.map(numStart => ({
        config: 'suits',
        count: 1,
        generateParams: { numStart, suiti }
      }))
    );
    
    this.setDiceConfigs(rawConfigs);
  }
}

gt.Poker = class Poker extends DiceSet {
  constructor() {
    super();
    this.playerCount = 2;
    this.dicePerThrow = 5;
    
    //this.create5x5RotatedFaces();
    this.create4x9RotatedFaces();
    
    // this.handOdds = [
      // ["None", 0],
      // ["Pair", 1],
      // ["Pair Flush", 5],
      // ["2 Pair", 10],
      // ["3 of a Kind", 20],
      // ["2 Pair Flush", 35],
      // ["Little 3 Straight", 60],
      // ["3 of a Kind Flush", 100],
      // ["Full House", 200],
      // ["Medium 4 Straight", 300],
      // ["4 of a Kind", 750],
      // ["Full House Flush", 850],
      // ["Straight", 1100],
      // ["Little 3 Straight Flush", 3000],
      // ["4 of a Kind Flush", 4000],
      // ["Medium 4 Straight Flush", 15000],
      // ["Straight Flush", 50000],
      // ["5 of a Kind", 75000],
      // ["5 of a Kind Flush", 350000]
    // ];
    // this.handOdds = [
      // ["None", 0],
      // ["Pair", 1],
      // ["Pair Flush", 5],
      // ["2 Pair", 10],
      // ["3 of a Kind", 20],
      // ["Small Straight", 300],
      // ["Small Flush", 1100],
      // ["Full House", 200],
      // ["Straight", 1100],            
      // ["2 Pair Flush", 35],
      // ["4 of a Kind", 750],      
      // ["3 of a Kind Flush", 100],
      // ["Small Straight Flush", 15000],
      // ["Flush", 1100],      
      // ["5 of a Kind", 75000],      
      // ["Full House Flush", 850],
      // ["4 of a Kind Flush", 4000],
      // ["Straight Flush", 50000],      
      // ["5 of a Kind Flush", 350000]
    // ];
    
    this.handOdds = [
      ["None", 0],
      ["Pair", 1],
      ["Pair Flush", 4],
      ["2 Pair", 6],
      ["3 of a Kind", 8],
      ["Small Straight", 10],
      ["Small Flush", 30],
      ["Full House", 65],
      ["Straight", 70],
      ["2 Pair Flush", 105],
      ["4 of a Kind", 135],
      ["3 of a Kind Flush", 230],
      ["Small Straight Flush", 1100],
      ["Flush", 1300],
      ["5 of a Kind", 6000],
      ["Full House Flush", 10000],
      ["4 of a Kind Flush", 60000],
      ["Straight Flush", 100000]
    ];
    
    this.handDisplayOpacity = 1;
    this.handTextSize = 20;
    
    this.curHand = { handi: 0, top: 0, next: 0 };
  }
  
  create5x5ShuffledFaces(){
    const suitNames = ['heart', 'diamond', 'club', 'spade'];
    const suitColors = ['#ff2222', '#ff7700', '#884488', '#555599'];
    const numbers = ['1', '2', '3', '4', '5'];

    const allFaces = [];
    for (let i = 0; i < 5; i++) { // 5 instances of each combination
      suitNames.forEach((suit, suitIndex) => {
        numbers.forEach(num => {
          const face = num === '1'
            ? `${num}-${suit}-${suitColors[suitIndex]}-2.2`
            : `${num}-${suit}-${suitColors[suitIndex]}-1.2`;
          allFaces.push({
            face,
            suit,
            num,
            suitIndex
          });
        });
      });
    }

    const shuffledFaces = shuffleArray(allFaces);

    // Distribute faces to 20 dice, 5 faces each, no duplicates per die
    const diceFaceAssignments = [];
    for (let i = 0; i < 20; i++) {
      diceFaceAssignments.push([]);
    }

    // Assign faces to dice
    let faceIndex = 0;
    for (let dieIndex = 0; dieIndex < 20; dieIndex++) {
      const usedFaces = new Set(); // Track faces used on this die
      for (let faceCount = 0; faceCount < 5; faceCount++) {
        // Find a face that hasn't been used on this die
        while (faceIndex < shuffledFaces.length) {
          const candidate = shuffledFaces[faceIndex];
          const faceKey = `${candidate.num}-${candidate.suit}`;
          if (!usedFaces.has(faceKey)) {
            diceFaceAssignments[dieIndex].push(candidate);
            usedFaces.add(faceKey);
            faceIndex++;
            break;
          }
          faceIndex++;
        }
        // If we run out of valid faces, reshuffle remaining and retry
        if (diceFaceAssignments[dieIndex].length < faceCount + 1) {
          const remainingFaces = shuffledFaces.slice(faceIndex);
          shuffleArray(remainingFaces);
          shuffledFaces.splice(faceIndex, shuffledFaces.length - faceIndex, ...remainingFaces);
          faceIndex = 0;
          diceFaceAssignments[dieIndex] = [];
          usedFaces.clear();
          faceCount = -1; // Retry this die
        }
      }
    }

    // Generate dice configs
    const rawConfigs = diceFaceAssignments.map((faces, dieIndex) => ({
      config: {
        faces: faces.map(f => f.face),
        color: '#eeeeee',
        faceColor: suitColors[faces[0].suitIndex],
        strokeColor: '#00000000'
      },
      count: 1,
      generateParams: {}
    }));

    this.setDiceConfigs(rawConfigs);
  }
  
  create5x5RotatedFaces(){
    const suits = ['heart', 'diamond', 'club', 'spade', 'moon'];
    const suitColors = ['#ff1111', '#ee7700', '#994499', '#5555aa', '#996644'];
    const numbers = [1, 2, 3, 4, 5];

    // Precalculated Latin square for suit index permutations
    const suitIndexPermutations = [
      [1, 2, 3, 4, 5],
      [2, 4, 1, 5, 3],
      [4, 5, 2, 3, 1],
      [5, 3, 4, 1, 2],
      [3, 1, 5, 2, 4]
    ];
    
    // Generate 5 rotated mappings for a given suit index permutation
    const getMappings = (suitIndices) => {
      const suitOrder = suitIndices.map(idx => suits[idx - 1]); // Map 1-based indices to suits
      const mappings = [];
      for (let i = 0; i < 5; i++) {
        const mapping = numbers.map((num, idx) => ({
          number: num,
          suit: suitOrder[(idx + i) % 5],
          color: suitColors[suits.indexOf(suitOrder[(idx + i) % 5])]
        }));
        mappings.push(mapping);
      }
      return mappings;
    };

    const rawConfigs = Array.from({ length: 25 }, (_, i) => {
      const setIndex = Math.floor(i / 5); // Which set (0 to 4)
      const dieIndexInSet = i % 5; // Which die in the set (0 to 4)
      const suitIndices = suitIndexPermutations[setIndex];
      const mappings = getMappings(suitIndices);
      const mapping = mappings[dieIndexInSet];

      return {
        config: {
          generate: () => {
            const faces = mapping.map(pair => 
              `${pair.number}-${pair.suit}-${pair.color}-${pair.number === 1 ? 2.2 : 1.2}`
            );
            return {
              faces,
              color: '#eeeeee',
              faceColor: mapping[0].color,
              strokeColor: '#00000000'
            };
          }
        },
        count: 1,
        generateParams: { setIndex, dieIndexInSet }
      };
    });
    
    this.setDiceConfigs(rawConfigs);
  }
  
  create4x9RotatedFaces() {
    const suits = ['heart', 'diamond', 'club', 'spade'];
    const suitColors = ['#ff1111', '#ee7700', '#994499', '#5555aa', '#996644'];
    
    const numbers = [
      [ 1, 2,    4, 5,    7, 8,   ],
      [ 1,    3, 4,    6, 7,    9 ],
      [    2, 3,    5, 6,    8, 9 ],
      
      [ 1, 2, 3,    5, 6, 7,      ],
      [    2, 3, 4,       7, 8, 9 ],
      [ 1,       4, 5, 6,    8, 9 ]
    ]
      

    const rawConfigs = Array.from({ length: 24 }, (_, i) => {
      const suitIndex = Math.floor(i / 6); // 0 to 3 for suits
      const numberSetIndex = i % 6; // 0 to 5 for number arrays
      const suit = suits[suitIndex];
      const color = suitColors[suitIndex];
      const numberSet = numbers[numberSetIndex];

      return {
        config: {
          generate: () => {
            const faces = numberSet.map(num => 
              `${num}-${suit}-${color}-${num === 1 ? 2.2 : num < 6 ? 1.2  : 1 }`
            );
            return {
              faces,
              color: '#eeeeee',
              faceColor: color,
              strokeColor: '#00000000'
            };
          }
        },
        count: 1,
        generateParams: { suitIndex, numberSetIndex }
      };
    });
    
    this.setDiceConfigs(rawConfigs);
  }
  
  init() {
    super.init();
    
    gt.keepSpot = new TableSpot({
      title: 'KEEP',
      enabled:false,
      shape: 'rect',
      bgColor: '#00000011',
      borderColor: '#99999933',
      borderWidth: 3,
      borderType: 'solid',
      titleColor: '#ffffff66',
      titleFont: '44px Thin',      
      onDropCallback: this.keepDrop.bind(this)
     
    });
    tableSpots.push( keepSpot );
    
    const spotConfig = {
      shape: 'rect',
      bgColor: '#ffffff33',
      pressedBgColor: '#ffff6644',
      borderColor: '#eeeeee66',
      borderWidth: 3,
      borderType: 'solid',      
      titleColor: '#ffffff66',
      titleFont: '44px Thin'
    };
    gt.doneSpot = new TableSpot({
      ...spotConfig,
      title: 'DONE',
      enabled:false,      
      onTapCallback: this.doneKeep.bind(this)      
    });
    tableSpots.push( doneSpot );
    this.layout()
  }
  
  layout() {
    const keepH = tableHeight*.7;
    keepSpot.x = 90;
    keepSpot.y = tableHeight/2-10;
    keepSpot.width = 160;
    keepSpot.height = keepH;
    
    doneSpot.x = tableWidth * .66;
    doneSpot.y = tableHeight - 80;
    doneSpot.width = 200;
    doneSpot.height = 70;
  }
  
  drawBg() {
    this.drawHandOdds();
  }
  
  doneKeep() {    
    //save current dice
    const curPlayer = players.getCurrentPlayer();
    
    while (keepSpot.heldDice.length > 0) {
      const d = keepSpot.heldDice[0];
      keepSpot.removeDice(d);
      dice.splice(dice.indexOf(d), 1);
      curPlayer.heldDice.push(d);
      d.visible = false;
    }
    curPlayer.curHand = this.curHand;
    
    //return unlocked to bag
    dice.filter(d => !keepSpot.heldDice.includes(d) )
      .forEach( d => d.sideLocked=false );
      
    diceBag.returnUnlocked();
    
    doneSpot.enabled = false;
    diceBag.rollLock=false;
    
    addAction( new gt.ScoreAndNextTurnAct({
      startNextCallback: () => {
        //pull next players saved dice back out
        const curPlayer = players.getCurrentPlayer();        
        curPlayer.heldDice.forEach( d=> {
          dice.push(d);
          keepSpot.addDice(d);  
          d.visible=true;
        });
        curPlayer.heldDice.length=0;        
        this.dicePerThrow = Math.min( 5, 7-keepSpot.heldDice.length);
        this.curHand = curPlayer.curHand || { handi: 0, top: 0, next: 0 };
      }
    }));
  }
  
  keepDrop(dices){
    dices.forEach( d => {
      if( keepSpot.heldDice.length<5 ){
        keepSpot.addDice(d);        
      }
      d.held=false;
    });
    
    this.checkKeptHand();
    
    return true;
  }
  
  dropCallback(dices){
    dices.forEach( die => { keepSpot.removeDice(die); } );
    
    this.checkKeptHand();
  }
  
  stoppedCallback() {
    const face = this.faces[this.currentSide];    
    this.sideLocked = true;
  }
    
  allStoppedCallback() {
    diceBag.rollLock=true;
    keepSpot.enabled = true;
    doneSpot.enabled = true;    
  }

  compareHands( handa, handb ){
    if( handa.handi != handb.handi ){
       return handa.handi - handb.handi;
    } else
    if( handa.top != handb.top ){
      return handa.top - handb.top;
    } else {
      return handa.next - handb.next;
    }
  }
  
  compareHandsAndWhen( handa, handb ){
    const beforeWhen = this.compareHands( handa, handb );
    
    if( beforeWhen!=0 ){
      return beforeWhen
    }else{
      //smaller is better
      return handb.when - handa.when;
    }
  }
  
  checkKeptHand() {
    const newHand = this.checkDiceHand( keepSpot.heldDice );
    
    if( this.compareHands( newHand, this.curHand )==0 ){  return;  }
    
    newHand.when = performance.now();
    
    this.curHand = newHand;
    players.getCurrentPlayer().curHand = newHand;
    
    let text = this.handOdds[newHand.handi][0];
    //const topText = newHand.top == 1 ? "ace" : newHand.top;
    //const nextText = newHand.top == 1 ? "ace" : newHand.top;
    if( newHand.top>0 && newHand.next>0 ){
      text+= "\n" + newHand.top + "s over " + newHand.next+"s";
    }else    
    if( newHand.top>0 ){ 
      text+= "\n" + newHand.top + " high";
    } 
    
    addAction( new gt.TextPopupAct({
      text: text,
      x: keepSpot.x + keepSpot.width/2 + 5,
      //y: keepSpot.y - keepSpot.height/2,
      y: keepSpot.heldDice[ keepSpot.heldDice.length-1].y,
      font: '30px Thin',
      textAlign: 'left',
      color: '#8888ff',
      holdDuration: .3,
      fadeDuration: 1,
      fadeScale: 1.00
    }) );    
  }

  checkDiceHand(dice) {
    const handOdds = this.handOdds;

    // Parse dice into number and suit
    const parsedDice = dice.map(d => {
      const [number, suit] = d.faces[d.currentSide].split('-');
      return { number: parseInt(number), suit };
    });

    // Helper: Generate combinations of given size
    function getCombinations(arr, size) {
      const results = [];
      function combine(start, combo) {
        if (combo.length === size) {
          results.push([...combo]);
          return;
        }
        for (let i = start; i < arr.length; i++) {
          combo.push(arr[i]);
          combine(i + 1, combo);
          combo.pop();
        }
      }
      combine(0, []);
      return results;
    }

    // Helper: Count occurrences by number
    const getNumberCounts = (dice) => {
      const counts = {};
      dice.forEach(d => {
        counts[d.number] = (counts[d.number] || 0) + 1;
      });
      return counts;
    };

    // Helper: Count occurrences by suit
    const getSuitCounts = (dice) => {
      const counts = {};
      dice.forEach(d => {
        counts[d.suit] = (counts[d.suit] || 0) + 1;
      });
      return counts;
    };

    // Helper: Count identical faces (number and suit)
    const getIdenticalCounts = (dice) => {
      const counts = {};
      dice.forEach(d => {
        const face = `${d.number}-${d.suit}`;
        counts[face] = (counts[face] || 0) + 1;
      });
      return Object.values(counts);
    };

    // Helper: Check if numbers form a straight
    const isStraight = (numbers) => {
      const sorted = [...new Set(numbers)].sort((a, b) => a - b);
      if (sorted.length < numbers.length) return false; // No duplicates
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) return false;
      }
      return true;
    };

    // Helper: Check if all dice have the same suit
    const isFlush = (dice) => {
      if (dice.length === 0) return false;
      const suit = dice[0].suit;
      return dice.every(d => d.suit === suit);
    };

    // Helper: Get highest number from counts with minimum occurrence
    const getTopNumber = (counts, minCount) => {
      let maxNumber = 0;
      for (const num in counts) {
        if (counts[num] >= minCount && parseInt(num) > maxNumber) {
          maxNumber = parseInt(num);
        }
      }
      return maxNumber;
    };

    // Helper: Get second-highest number from counts with minimum occurrence
    const getNextNumber = (counts, minCount, excludeNumber) => {
      let maxNumber = 0;
      for (const num in counts) {
        const n = parseInt(num);
        if (counts[num] >= minCount && n > maxNumber && n !== excludeNumber) {
          maxNumber = n;
        }
      }
      return maxNumber;
    };

    // Check hands from highest to lowest rank
    for (let handi = handOdds.length - 1; handi >= 0; handi--) {
      const [handName] = handOdds[handi];

      if (handName === "5 of a Kind Flush" && parsedDice.length >= 5) {
        const identicalCounts = getIdenticalCounts(parsedDice);
        if (identicalCounts.includes(5)) {
          const top = getTopNumber(getNumberCounts(parsedDice), 5);
          return { handi, top, next: 0 };
        }
      }

      if (handName === "5 of a Kind" && parsedDice.length >= 5) {
        const numberCounts = getNumberCounts(parsedDice);
        if (Object.values(numberCounts).includes(5)) {
          const top = getTopNumber(numberCounts, 5);
          return { handi, top, next: 0 };
        }
      }

      if (handName === "Straight Flush" && parsedDice.length >= 5) {
        if (isStraight(parsedDice.map(d => d.number)) && isFlush(parsedDice)) {
          const top = Math.max(...parsedDice.map(d => d.number));
          return { handi, top, next: 0 };
        }
      }

      if (handName === "Small Straight Flush" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          if (isStraight(combo.map(d => d.number)) && isFlush(combo)) {
            const top = Math.max(...combo.map(d => d.number));
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "4 of a Kind Flush" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          if (getIdenticalCounts(combo).includes(4)) {
            const top = getTopNumber(getNumberCounts(combo), 4);
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Little 3 Straight Flush" && parsedDice.length >= 3) {
        const combos3 = getCombinations(parsedDice, 3);
        for (const combo of combos3) {
          if (isStraight(combo.map(d => d.number)) && isFlush(combo)) {
            const top = Math.max(...combo.map(d => d.number));
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Straight" && parsedDice.length >= 5) {
        if (isStraight(parsedDice.map(d => d.number))) {
          const top = Math.max(...parsedDice.map(d => d.number));
          return { handi, top, next: 0 };
        }
      }
      
      if (handName === "Small Flush" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          if (isFlush(combo)) {
            const top = Math.max(...combo.map(d => d.number));
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Flush" && parsedDice.length >= 5) {
        if (isFlush(parsedDice)) {
          const top = Math.max(...parsedDice.map(d => d.number));
          return { handi, top, next: 0 };
        }
      }

      if (handName === "Full House Flush" && parsedDice.length >= 5) {
        const identicalCounts = getIdenticalCounts(parsedDice);
        if (identicalCounts.includes(3) && identicalCounts.includes(2)) {
          const numberCounts = getNumberCounts(parsedDice);
          const top = getTopNumber(numberCounts, 3);
          const next = getNextNumber(numberCounts, 2, top);
          return { handi, top, next };
        }
      }

      if (handName === "4 of a Kind" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          const numberCounts = getNumberCounts(combo);
          if (Object.values(numberCounts).includes(4)) {
            const top = getTopNumber(numberCounts, 4);
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Small Straight" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          if (isStraight(combo.map(d => d.number))) {
            const top = Math.max(...combo.map(d => d.number));
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Full House" && parsedDice.length >= 5) {
        const numberCounts = getNumberCounts(parsedDice);
        if (Object.values(numberCounts).includes(3) && Object.values(numberCounts).includes(2)) {
          const top = getTopNumber(numberCounts, 3);
          const next = getNextNumber(numberCounts, 2, top);
          return { handi, top, next };
        }
      }

      if (handName === "3 of a Kind Flush" && parsedDice.length >= 3) {
        const combos3 = getCombinations(parsedDice, 3);
        for (const combo of combos3) {
          if (getIdenticalCounts(combo).includes(3)) {
            const top = getTopNumber(getNumberCounts(combo), 3);
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Little 3 Straight" && parsedDice.length >= 3) {
        const combos3 = getCombinations(parsedDice, 3);
        for (const combo of combos3) {
          if (isStraight(combo.map(d => d.number))) {
            const top = Math.max(...combo.map(d => d.number));
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "2 Pair Flush" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          const identicalCounts = getIdenticalCounts(combo);
          if (identicalCounts.filter(c => c === 2).length >= 2) {
            const numberCounts = getNumberCounts(combo);
            const top = getTopNumber(numberCounts, 2);
            const next = getNextNumber(numberCounts, 2, top);
            return { handi, top, next };
          }
        }
      }

      if (handName === "2 Pair" && parsedDice.length >= 4) {
        const combos4 = getCombinations(parsedDice, 4);
        for (const combo of combos4) {
          const numberCounts = getNumberCounts(combo);
          if (Object.values(numberCounts).filter(c => c >= 2).length >= 2) {
            const top = getTopNumber(numberCounts, 2);
            const next = getNextNumber(numberCounts, 2, top);
            return { handi, top, next };
          }
        }
      }

      if (handName === "3 of a Kind" && parsedDice.length >= 3) {
        const combos3 = getCombinations(parsedDice, 3);
        for (const combo of combos3) {
          const numberCounts = getNumberCounts(combo);
          if (Object.values(numberCounts).includes(3)) {
            const top = getTopNumber(numberCounts, 3);
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Pair Flush" && parsedDice.length >= 2) {
        const combos2 = getCombinations(parsedDice, 2);
        for (const combo of combos2) {
          if (combo[0].number === combo[1].number && combo[0].suit === combo[1].suit) {
            const top = combo[0].number;
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "Pair" && parsedDice.length >= 2) {
        const combos2 = getCombinations(parsedDice, 2);
        for (const combo of combos2) {
          if (combo[0].number === combo[1].number) {
            const top = combo[0].number;
            return { handi, top, next: 0 };
          }
        }
      }

      if (handName === "None") {
        return { handi, top: 0, next: 0 };
      }
    }

    return { handi: 0, top: 0, next: 0 }; // Default if no hand matches
  }  

  checkAllDiceHands(dice) {
    const results = [];

    // Parse dice into number and suit
    const parsedDice = dice.map(d => {
      const [number, suit] = d.faces[d.currentSide].split('-');
      return { number: parseInt(number), suit };
    });

    // Helper: Generate combinations of given size
    function getCombinations(arr, size) {
      const combos = [];
      function combine(start, combo) {
        if (combo.length === size) {
          combos.push([...combo]);
          return;
        }
        for (let i = start; i < arr.length; i++) {
          combo.push(arr[i]);
          combine(i + 1, combo);
          combo.pop();
        }
      }
      combine(0, []);
      return combos;
    }

    // Helper: Count occurrences by number
    const getNumberCounts = (dice) => {
      const counts = {};
      dice.forEach(d => {
        counts[d.number] = (counts[d.number] || 0) + 1;
      });
      return counts;
    };

    // Helper: Count occurrences by suit
    const getSuitCounts = (dice) => {
      const counts = {};
      dice.forEach(d => {
        counts[d.suit] = (counts[d.suit] || 0) + 1;
      });
      return counts;
    };

    // Helper: Count identical faces (number and suit)
    const getIdenticalCounts = (dice) => {
      const counts = {};
      dice.forEach(d => {
        const face = `${d.number}-${d.suit}`;
        counts[face] = (counts[face] || 0) + 1;
      });
      return Object.values(counts);
    };

    // Helper: Check if numbers form a straight
    const isStraight = (numbers) => {
      const sorted = [...new Set(numbers)].sort((a, b) => a - b);
      if (sorted.length < numbers.length) return false; // No duplicates
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) return false;
      }
      return true;
    };

    // Helper: Check if all dice have the same suit
    const isFlush = (dice) => {
      if (dice.length === 0) return false;
      const suit = dice[0].suit;
      return dice.every(d => d.suit === suit);
    };

    // Helper: Get highest number from counts with minimum occurrence
    const getTopNumber = (counts, minCount) => {
      let maxNumber = 0;
      for (const num in counts) {
        if (counts[num] >= minCount && parseInt(num) > maxNumber) {
          maxNumber = parseInt(num);
        }
      }
      return maxNumber;
    };

    // Helper: Get second-highest number from counts with minimum occurrence
    const getNextNumber = (counts, minCount, excludeNumber) => {
      let maxNumber = 0;
      for (const num in counts) {
        const n = parseInt(num);
        if (counts[num] >= minCount && n > maxNumber && n !== excludeNumber) {
          maxNumber = n;
        }
      }
      return maxNumber;
    };

    // Check each hand type
    // 5 of a Kind Flush
    if (parsedDice.length >= 5) {
      const identicalCounts = getIdenticalCounts(parsedDice);
      if (identicalCounts.includes(5)) {
        const top = getTopNumber(getNumberCounts(parsedDice), 5);
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "5 of a Kind Flush"), top, next: 0 });
      }
    }

    // 5 of a Kind
    if (parsedDice.length >= 5) {
      const numberCounts = getNumberCounts(parsedDice);
      if (Object.values(numberCounts).includes(5)) {
        const top = getTopNumber(numberCounts, 5);
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "5 of a Kind"), top, next: 0 });
      }
    }

    // Straight Flush
    if (parsedDice.length >= 5) {
      if (isStraight(parsedDice.map(d => d.number)) && isFlush(parsedDice)) {
        const top = Math.max(...parsedDice.map(d => d.number));
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "Straight Flush"), top, next: 0 });
      }
    }
    
    // Small Flush
     if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        if (isFlush(combo)) {
          const top = Math.max(...combo.map(d => d.number));
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Small Flush"), top, next: 0 });
          break;
        }
      }
    }

    // Flush
    if (parsedDice.length >= 5) {
      if (isFlush(parsedDice)) {
        const top = Math.max(...parsedDice.map(d => d.number));
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "Flush"), top, next: 0 });
      }
    }

    // Small Straight Flush
    if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        if (isStraight(combo.map(d => d.number)) && isFlush(combo)) {
          const top = Math.max(...combo.map(d => d.number));
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Small Straight Flush"), top, next: 0 });
          break;
        }
      }
    }

    // 4 of a Kind Flush
    if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        if (getIdenticalCounts(combo).includes(4)) {
          const top = getTopNumber(getNumberCounts(combo), 4);
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "4 of a Kind Flush"), top, next: 0 });
          break;
        }
      }
    }

    // Little 3 Straight Flush
    if (parsedDice.length >= 3) {
      const combos3 = getCombinations(parsedDice, 3);
      for (const combo of combos3) {
        if (isStraight(combo.map(d => d.number)) && isFlush(combo)) {
          const top = Math.max(...combo.map(d => d.number));
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Little 3 Straight Flush"), top, next: 0 });
          break;
        }
      }
    }

    // Straight
    if (parsedDice.length >= 5) {
      if (isStraight(parsedDice.map(d => d.number))) {
        const top = Math.max(...parsedDice.map(d => d.number));
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "Straight"), top, next: 0 });
      }
    }

    // Full House Flush
    if (parsedDice.length >= 5) {
      const identicalCounts = getIdenticalCounts(parsedDice);
      if (identicalCounts.includes(3) && identicalCounts.includes(2)) {
        const numberCounts = getNumberCounts(parsedDice);
        const top = getTopNumber(numberCounts, 3);
        const next = getNextNumber(numberCounts, 2, top);
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "Full House Flush"), top, next });
      }
    }

    // 4 of a Kind
    if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        const numberCounts = getNumberCounts(combo);
        if (Object.values(numberCounts).includes(4)) {
          const top = getTopNumber(numberCounts, 4);
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "4 of a Kind"), top, next: 0 });
          break;
        }
      }
    }

    // Small Straight
    if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        if (isStraight(combo.map(d => d.number))) {
          const top = Math.max(...combo.map(d => d.number));
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Small Straight"), top, next: 0 });
          break;
        }
      }
    }

    // Full House
    if (parsedDice.length >= 5) {
      const numberCounts = getNumberCounts(parsedDice);
      if (Object.values(numberCounts).includes(3) && Object.values(numberCounts).includes(2)) {
        const top = getTopNumber(numberCounts, 3);
        const next = getNextNumber(numberCounts, 2, top);
        results.push({ handi: this.handOdds.findIndex(h => h[0] === "Full House"), top, next });
      }
    }

    // 3 of a Kind Flush
    if (parsedDice.length >= 3) {
      const combos3 = getCombinations(parsedDice, 3);
      for (const combo of combos3) {
        if (getIdenticalCounts(combo).includes(3)) {
          const top = getTopNumber(getNumberCounts(combo), 3);
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "3 of a Kind Flush"), top, next: 0 });
          break;
        }
      }
    }

    // Little 3 Straight
    if (parsedDice.length >= 3) {
      const combos3 = getCombinations(parsedDice, 3);
      for (const combo of combos3) {
        if (isStraight(combo.map(d => d.number))) {
          const top = Math.max(...combo.map(d => d.number));
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Little 3 Straight"), top, next: 0 });
          break;
        }
      }
    }

    // 2 Pair Flush
    if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        const identicalCounts = getIdenticalCounts(combo);
        if (identicalCounts.filter(c => c === 2).length >= 2) {
          const numberCounts = getNumberCounts(combo);
          const top = getTopNumber(numberCounts, 2);
          const next = getNextNumber(numberCounts, 2, top);
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "2 Pair Flush"), top, next });
          break;
        }
      }
    }

    // 2 Pair
    if (parsedDice.length >= 4) {
      const combos4 = getCombinations(parsedDice, 4);
      for (const combo of combos4) {
        const numberCounts = getNumberCounts(combo);
        if (Object.values(numberCounts).filter(c => c >= 2).length >= 2) {
          const top = getTopNumber(numberCounts, 2);
          const next = getNextNumber(numberCounts, 2, top);
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "2 Pair"), top, next });
          break;
        }
      }
    }

    // 3 of a Kind
    if (parsedDice.length >= 3) {
      const combos3 = getCombinations(parsedDice, 3);
      for (const combo of combos3) {
        const numberCounts = getNumberCounts(combo);
        if (Object.values(numberCounts).includes(3)) {
          const top = getTopNumber(numberCounts, 3);
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "3 of a Kind"), top, next: 0 });
          break;
        }
      }
    }

    // Pair Flush
    if (parsedDice.length >= 2) {
      const combos2 = getCombinations(parsedDice, 2);
      for (const combo of combos2) {
        if (combo[0].number === combo[1].number && combo[0].suit === combo[1].suit) {
          const top = combo[0].number;
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Pair Flush"), top, next: 0 });
          break;
        }
      }
    }

    // Pair
    if (parsedDice.length >= 2) {
      const combos2 = getCombinations(parsedDice, 2);
      for (const combo of combos2) {
        if (combo[0].number === combo[1].number) {
          const top = combo[0].number;
          results.push({ handi: this.handOdds.findIndex(h => h[0] === "Pair"), top, next: 0 });
          break;
        }
      }
    }

    // None (always applies if at least one die)
    if (parsedDice.length >= 1) {
      results.push({ handi: this.handOdds.findIndex(h => h[0] === "None"), top: 0, next: 0 });
    }

    return results;
  }
  
  drawHandOdds() {
    if (this.curHand.handi === 0 && keepSpot.heldDice.length === 0) return;

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eeeeee';
    ctx.shadowColor = '#000000dd';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.font = `${this.handTextSize/toTable}px Thin`;

    const curPlayer = players.getCurrentPlayer();
    const playerHands = players.players;    
    let linei=0;
    
    for (let i = 1; i < this.handOdds.length; i++) {
      const [handName] = this.handOdds[i];
      const curPlayersWithHand = playerHands
        .filter(p => p.curHand && p.curHand.handi === i)
        .sort((a, b) => this.compareHandsAndWhen(a.curHand, b.curHand));      
      
      if( curPlayersWithHand.length==0 ){ curPlayersWithHand.push( null ); }
      
      for( let pi=0; pi<curPlayersWithHand.length; pi++ ) {
        
        const player = curPlayersWithHand[pi];        
        const isCurrentHand = player == curPlayer;
        
        const playerName = player?.name;
        const playerHand = player?.curHand;
        
        const color = player==null ? '#aaaabb' : isCurrentHand ? '#ffee88' : '#eeeeee';
        ctx.fillStyle = color + Math.round(this.handDisplayOpacity * 255).toString(16).padStart(2, '0');
        const x = tableWidth / 2;
        const y = 180 + ((linei + 0.5) * this.handTextSize * 1.15) / toTable;
        
        ctx.textAlign = 'right';
        ctx.fillStyle = color + Math.round(this.handDisplayOpacity * 255).toString(16).padStart(2, '0');
        ctx.fillText( handName, x, y);

        // Draw player name for current hand
        if (playerName) {
          
          let type;
          if( player.curHand.next>0 ){
            type = `${player.curHand.top}s over ${player.curHand.next}s`;
          }else{
            type = `${player.curHand.top} high`;
          }
          
          ctx.textAlign = 'left';
          ctx.fillText( ` < ${playerName} (${type})`, x, y);
        }
        
        linei++;
      }
    }

    ctx.restore();
  }
    
  toSave() {
    return {
      endOfTurn: keepSpot.enabled,
    };
  }

  setFromSave(config) {
    keepSpot.enabled = config.endOfTurn;
    doneSpot.enabled = config.endOfTurn;
  } 
  
}
  
gt.AnyRoll = class AnyRoll extends DiceSet {
  constructor() {
    super();
    this.autoRefill = true;
    this.multiThrows = true;
    
    this.setDiceConfigs([
      { config: 'standard 6', count: 5 }
    ]);
  }
}

gt.Baseball = class Baseball extends DiceSet {
  constructor() {
    super();
    this.emptyOnRefill = true;
    //this.reuseUnlocked = true;
    this.autoRefill = true;
    this.multiThrows = true;
    this.dicePerThrow = 4; 
    this.winningScore = 13;
    this.playerCount = 0;
    this.BG_FILL = '#00aa33';

    this.setDiceConfigs([
      { config: 'bball-hit-nom', count: 6 },
      { config: 'bball-hit-good', count: 4 },
      { config: 'bball-pitch-nom', count: 6 },
      { config: 'bball-pitch-good', count: 4 }
    ]);
  }
  
}

gt.Arena = class Arena extends DiceSet {
  constructor() {
    super();
    this.autoRefill = true;
    this.multiThrows = true;
    
    this.BG_FILL = '#111111';
    
    this.setDiceConfigs([{
      config: {
        generate: () => {
          return {
            faces: [
              '3t-X-#ff0000-.8',
              '2-O-#ff0000-.8'
            ],
            color: '#eeeeee',
            faceColor: "#000000"            
          };
        }
      },
      count: 1      
    }]);
  }
  
  init() {
    super.init();    
    const spotConfig = {
      shape: 'rect',
      bgColor: '#888899',
      borderColor: '#666677',
      borderWidth: 3,
      borderType: 'solid',
      titleColor: '#ffffff66',
      titleFont: '44px Thin'      
    };
    gt.arenaSpot = new TableSpot({
      ...spotConfig,      
      title: ''      
    });
    tableSpots.push( arenaSpot );   
    
    this.layout();
  }
  
  layout() {
    const spacing = (tableWidth - 480) / 3;
    const edge = Dice_Size*1.2;
    
    arenaSpot.width = tableWidth - edge*2;
    arenaSpot.height = tableHeight - 400;
    arenaSpot.x = tableCenterX;
    arenaSpot.y = tableCenterY;
  }
  
   stoppedCallback() {
    this.sideLocked = true;
   }
}


}

{  // dice funcs
gt.drawShape = function(shape, shapeSize) {
  ctx.save();
  switch (shape) {
    case 'circle': {
      const radius = shapeSize * .4; // a little smaller
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, PI * 2);
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'square': {
      const pointDist = shapeSize * .9; // a little smaller
      ctx.fillRect(-pointDist / 2, -pointDist / 2, pointDist, pointDist);
      break;
    }
    case 'triangle': {
      const pointDist = shapeSize * (2 / 3);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = PI * 2 / 3 * i - PI / 2;
        ctx.lineTo(Math.cos(angle) * pointDist, Math.sin(angle) * pointDist);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'star': {
      const inPointDist = shapeSize * .3;
      const outPointDist = shapeSize * .65;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = PI / 5 * i - PI / 2;
        const r = i % 2 === 0 ? outPointDist : inPointDist;
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'pentagon': {
      ctx.beginPath();
      const pointDist = shapeSize * .5;
      for (let i = 0; i < 5; i++) {
        const angle = PI * 2 / 5 * i - PI / 2;
        ctx.lineTo(Math.cos(angle) * pointDist, Math.sin(angle) * pointDist);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'cross': {
      const armLength = shapeSize / 2;
      const armWidth = shapeSize / 3;
      ctx.beginPath();
      ctx.moveTo(-armWidth / 2, -armLength);
      ctx.lineTo(-armWidth / 2, -armWidth / 2);
      ctx.lineTo(-armLength, -armWidth / 2);
      ctx.lineTo(-armLength, armWidth / 2);
      ctx.lineTo(-armWidth / 2, armWidth / 2);
      ctx.lineTo(-armWidth / 2, armLength);
      ctx.lineTo(armWidth / 2, armLength);
      ctx.lineTo(armWidth / 2, armWidth / 2);
      ctx.lineTo(armLength, armWidth / 2);
      ctx.lineTo(armLength, -armWidth / 2);
      ctx.lineTo(armWidth / 2, -armWidth / 2);
      ctx.lineTo(armWidth / 2, -armLength);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'X': {
      const armLength = shapeSize / 2;
      const armWidth = shapeSize* .2;
      const armWidthHalf = armWidth/2.1;
      const armWidthWideHalf = armWidth/1.5;
      ctx.rotate(PI / 4); // Rotate 45 degrees to make X
      ctx.beginPath();
      ctx.moveTo(-armWidthWideHalf, -armLength);
      ctx.lineTo(-armWidthHalf, -armWidthHalf);
      ctx.lineTo(-armLength, -armWidthWideHalf); // left
      ctx.lineTo(-armLength, armWidthWideHalf);
      ctx.lineTo(-armWidthHalf, armWidthHalf);
      ctx.lineTo(-armWidthWideHalf, armLength); //bottom
      ctx.lineTo(armWidthWideHalf, armLength);
      ctx.lineTo(armWidthHalf, armWidthHalf);
      ctx.lineTo(armLength, armWidthWideHalf);  //right
      ctx.lineTo(armLength, -armWidthWideHalf);
      ctx.lineTo(armWidthHalf, -armWidthHalf);
      ctx.lineTo(armWidthWideHalf, -armLength);  //top
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'O': {
      const outerRadius = shapeSize * .45;
      const innerRadius = shapeSize * .3;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, 0, PI * 2);
      ctx.arc(0, 0, innerRadius, 0, PI * 2, true);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'hmoon': {
      const outerRadius = shapeSize * .48;
      const innerRadius = shapeSize * .37;      
      ctx.rotate(PI / 4);
      ctx.beginPath();
      ctx.arc( 0, 0, outerRadius, 0, PI * 2);      
      ctx.arc( 0, 0, innerRadius, 0, PI, true);
      ctx.lineTo( innerRadius, 0 );
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'moon': {
      const outerRadius = shapeSize * .49;
      const innerRadius = shapeSize * .3;
      ctx.rotate(-PI / 4);
      ctx.beginPath();
      ctx.arc( 0, 0, outerRadius, PI*.3, PI*1.7);
      ctx.arc( outerRadius-innerRadius, 0, innerRadius, PI*1.55, PI*.45, true);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'doubleO': {
      const outerRadius = shapeSize * .45;
      const innerRadius = shapeSize * .3;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, 0, PI * 2);
      ctx.arc(0, 0, innerRadius, 0, PI * 2, true);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      const radius = shapeSize * .12;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, PI * 2);
      ctx.stroke();
      ctx.fill();        
      break;
    }
    case 'diamond': {
      const pointDist = shapeSize / 2;
      ctx.beginPath();
      ctx.moveTo(0, -pointDist);
      ctx.lineTo(pointDist, 0);
      ctx.lineTo(0, pointDist);
      ctx.lineTo(-pointDist, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'heart': {
      const scale = shapeSize * .45;
      const lobeRadius = scale * .55;
      const spread = scale * 1.1;
      const height = scale * 1.8;

      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(-spread, -height / 2 + lobeRadius);
      ctx.arc(-spread + lobeRadius, -height / 2 + lobeRadius, lobeRadius, PI, 0, false);
      ctx.arc(spread - lobeRadius, -height / 2 + lobeRadius, lobeRadius, PI, 0, false);
      ctx.lineTo(spread, -height / 2 + lobeRadius);
      ctx.lineTo(0, height / 2);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'club': {
      const scale = shapeSize / 2;
      const lobeRadius = scale * 0.48;
      const spread = scale * 1;
      const height = scale * 1.9;
      const stemTopWidth = scale * 0.1;
      const stemBottomWidth = scale * 0.45;
      const stemHeight = scale * 1;

      ctx.beginPath();
      ctx.arc(-spread + lobeRadius, shapeSize * .1, lobeRadius, 0, PI * 2, false);      
      ctx.arc(0, -height / 2 + lobeRadius, lobeRadius, 0, PI * 2, false);
      ctx.arc(spread - lobeRadius, shapeSize * .1, lobeRadius, 0, PI * 2, false);      
      ctx.moveTo(-stemTopWidth / 2, 0);
      ctx.lineTo(stemTopWidth / 2, 0);
      ctx.lineTo(stemBottomWidth / 2, 0 + stemHeight);
      ctx.lineTo(-stemBottomWidth / 2, 0 + stemHeight);
      ctx.lineTo(-stemTopWidth / 2, 0);
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'spade': {
      const scale = shapeSize / 2;
      const lobeRadius = scale * 0.45;
      const spread = scale * 1;
      const height = scale * 2;
      const stemTopWidth = scale * 0.1;
      const stemBottomWidth = scale * 0.45;
      const stemHeight = scale * 0.7;

      ctx.beginPath();
      ctx.moveTo(0, -height / 2);
      ctx.lineTo(spread, -height / 2 + 2 * lobeRadius);
      ctx.arc(spread - lobeRadius, -height / 2 + 2 * lobeRadius, lobeRadius, 0, PI, false);
      ctx.arc(-spread + lobeRadius, -height / 2 + 2 * lobeRadius, lobeRadius, 0, PI, false);
      ctx.lineTo(-spread, -height / 2 + 2 * lobeRadius);
      ctx.lineTo(0, -height / 2); // Manually close the main body
      // Stem
      ctx.moveTo(-stemTopWidth / 2, 0);
      ctx.lineTo(stemTopWidth / 2, 0);
      ctx.lineTo(stemBottomWidth / 2, 0 + stemHeight);
      ctx.lineTo(-stemBottomWidth / 2, 0 + stemHeight);
      ctx.lineTo(-stemTopWidth / 2, 0); // Manually close the stem
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'gear': {
      const outerRadius = shapeSize * 0.46; // Cog tips
      const midRadius = shapeSize * 0.35;   // Cog base
      const minRadius = shapeSize * 0.15;   // Central hole
      const cogCount = 6;
      const angleStep = PI * 2 / (cogCount * 2); // 4 segments per cog

      ctx.beginPath();
      // Draw gear with cogs
      for (let i = 0; i < cogCount; i++) {
        const baseAngle = i * PI * 2 / cogCount - PI / 2 + angleStep/2;
        ctx.lineTo(Math.cos(baseAngle) * midRadius, Math.sin(baseAngle) * midRadius);
        ctx.arc(0, 0, midRadius, baseAngle, baseAngle + angleStep);
        ctx.lineTo(Math.cos(baseAngle + angleStep) * outerRadius, Math.sin(baseAngle + angleStep) * outerRadius);
        ctx.arc(0, 0, outerRadius, baseAngle + angleStep, baseAngle + 2 * angleStep);
        ctx.lineTo(Math.cos(baseAngle + 2 * angleStep) * midRadius, Math.sin(baseAngle + 2 * angleStep) * midRadius);
        ctx.arc(0, 0, midRadius, baseAngle + 2 * angleStep, baseAngle + 3 * angleStep);
      }
      ctx.closePath();
      // Add central hole
      ctx.moveTo(minRadius, 0);
      ctx.arc(0, 0, minRadius, 0, PI * 2, true);
      ctx.fill('evenodd');
      break;
    }
    case 'bat': {
      const length = shapeSize * 1.1;
      const widthTop = shapeSize * 0.25;
      const widthBottom = widthTop * 0.15;
      const knobSize = shapeSize * 0.0;
      ctx.rotate(PI / 4); // Diagonal orientation
      ctx.beginPath();
      // Top rounded cap
      ctx.arc(0, -length / 2 + widthTop / 2, widthTop / 2, PI, 0);
      // Right side
      ctx.lineTo( widthBottom/2, length / 2 - knobSize);
      //ctx.lineTo( -widthBottom/2, length / 2 - knobSize);
      ctx.arc(0, length / 2 - widthBottom / 2, widthBottom / 2, 0, PI);      
      // // Left side
      ctx.lineTo(-widthTop / 2, -length / 2 + widthTop / 2);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'bball': {
      const outerRadius = shapeSize * .46;
      const innerRadius = shapeSize * .41;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, 0, PI * 2);
      ctx.arc(0, 0, innerRadius, 0, PI * 2, true);
      ctx.stroke();
      ctx.fill();
      const seamRadius = shapeSize * .35;
      const seamRadiusIn = shapeSize * .33;
      const seamOffset = shapeSize * .35;
      ctx.beginPath();
      ctx.arc(outerRadius, 0, seamRadius, PI*.74, PI * 1.25); // Right seam
      ctx.arc(outerRadius, 0, seamRadiusIn, PI * 1.25, PI*.74, true);
      ctx.stroke();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-outerRadius, 0, seamRadius, PI * 1.74, PI*.25); // Left seam
      ctx.arc(-outerRadius, 0, seamRadiusIn, PI * .25, PI*1.74, true);
      ctx.stroke();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function positionDiceAroundPoint(dice, centerX, centerY, direction = 0) {
  if (dice.length === 1) {
    dice[0].x = centerX;
    dice[0].y = centerY;
  } else {
    const radius = Dice_Size * (.7 + dice.length*.1);
    dice.forEach((die, i) => {
      const angle = direction + (2 * PI * i) / dice.length + (dice.length==2 ? -PI/2 : 0);
      die.x = centerX + Math.cos(angle) * radius;
      die.y = centerY + Math.sin(angle) * radius;
    });
  }
}

function diceInHand( input, dices ){
  gameState.diceRolling=true;
  
  positionDiceAroundPoint(dices, input.startX, input.startY);  
  dices.forEach(die => die.pickUp(input.touchId));
  input.diceGroup = dices;
}

function rollDice(dices, speed, direction) {
  if (dices.length === 0) return;

  // Calculate separation speed (inversely proportional to throw speed)
  const separationFactor = dices.length > 1 ? (1 - (speed / Max_SPEED)) : 0; // Inverse proportion
  const separationSpeed = 120 * separationFactor;
  
  // Calculate center of the dice group
  let centerX = 0, centerY = 0;
  dices.forEach(die => {
    centerX += die.x;
    centerY += die.y;
  });
  centerX /= dices.length;
  centerY /= dices.length;

  dices.forEach(die => {
    let finalSpeed = speed;
    let finalDirection = direction;

    if (dices.length > 1 && separationSpeed > 0) {
      // Calculate direction away from center
      const dx = die.x - centerX;
      const dy = die.y - centerY;
      const distance = Math.hypot(dx, dy);
      let sepDirection = distance > 0 ? Math.atan2(dy, dx) : Math.random() * PI * 2;

      // Combine throw velocity and separation velocity
      const throwVx = Math.cos(direction) * speed;
      const throwVy = Math.sin(direction) * speed;
      const sepVx = Math.cos(sepDirection) * separationSpeed;
      const sepVy = Math.sin(sepDirection) * separationSpeed;

      // Sum velocities
      const finalVx = throwVx + sepVx;
      const finalVy = throwVy + sepVy;

      finalSpeed = Math.hypot(finalVx, finalVy);
      finalDirection = Math.atan2(finalVy, finalVx);
    }

    die.setSpeedDirection(finalSpeed, finalDirection);
    die.held = null;
  });
}

function getDiceAt(x, y) {
  return dice.filter(d => {
    return gt.pointInRect(x, y, d.getCorners() );
  });
}
}

class DiceBag {
  constructor(diceSet) {
    if (typeof diceSet === 'string') {
      this.diceSet = new gt[diceSet]();
    } else {
      this.diceSet = new diceSet();
    }
    this.availableDice = [];
    this.drawBag = true;
    this.rollLock = false;
  }

  init() {
    this.refill();
    this.diceSet.init();
 }

  refill() {
    if (this.diceSet.emptyOnRefill) {
      this.availableDice = [];
    }    
    for (const diceParam of this.diceSet.diceConfigs) {    
      for (let i = 0; i < diceParam.count; i++) {
        const die = new Dice(0, 0, diceParam.config, null);
        this.availableDice.push(die);
      }
    }
    
    //this.cols = Math.round(Math.sqrt(this.availableDice.length / tableAspRat));
    //this.rowSize = Math.round(this.availableDice.length / this.cols);
    this.rowSize = Math.ceil( this.availableDice.length**.5 * 1.7)
  }

  returnUnlocked()
  {
    dice.filter(d => !d.sideLocked).forEach(d => {
      diceBag.availableDice.push(d);
      dice.splice(dice.indexOf(d), 1);
    });    
  }
  
  add(someDice) {
    someDice.forEach(die => this.availableDice.push(die));
  }
  
  openForRolls(){
    return !diceBag.rollLock && (this.diceSet.multiThrows || !gameState.diceRolling);
  }
  
  getDice( x=0, y=0 ) {
    
    diceBag.diceSet.preRollCallBack();
    
    let amount = this.diceSet.dicePerThrow;
    if (this.availableDice.length < amount && this.diceSet.autoRefill) {
      this.refill();
    }
    const selectedDice = [];
    
    if (this.diceSet.reuseUnlocked) {
      const unlockedDice = dice.filter(d => !d.sideLocked && !d.held);
      const reuseCount = Math.min(amount, unlockedDice.length);
      for (let i = 0; i < reuseCount; i++) {
        const die = unlockedDice[i];
        die.x = x;
        die.y = y;
        selectedDice.push(die);
      }
      amount -= reuseCount;
    }
    
    const availableCount = Math.min(amount, this.availableDice.length);
    for (let i = 0; i < availableCount; i++) {
      const randomIndex = Math.floor(Math.random() * this.availableDice.length);
      const die = this.availableDice.splice(randomIndex, 1)[0];
      die.x = x;
      die.y = y;
      selectedDice.push(die);
      dice.push(die);
    }
    return selectedDice;
  }

  update(deltaTime) {

  }
  
  draw() {
    if (!this.drawBag) return;

    const miniSize = 16 / toTable;
    const padding = 5
    const margin = 10;        

    this.availableDice.forEach((die, index) => {
      let row = index % this.rowSize;
      let col = Math.floor(index / this.rowSize);
      if( tableLayout=='p' ){
        let t=row; row=col; col=t;
      }
      const x = tableWidth - margin - (col * (miniSize + padding)) - miniSize / 2;
      const y = margin + row * (miniSize + padding) + miniSize / 2;

      // Save context and transform for mini dice
      ctx.save();
      ctx.beginPath(); 
      ctx.translate(x, y);
      die.drawAsIcon(miniSize / Dice_Size); // Use icon drawing
      ctx.restore();
    });
  }

  toSave() {
    return {
      diceSet: this.diceSet.name,
      availableDice: this.availableDice.map(d => d.toSave()),
      diceSetState: this.diceSet.toSave(),
      drawBag: this.drawBag,
      rollLock: this.rollLock
    };
  }

  setFromSave(config) {
    this.diceSet.setFromSave(config.diceSetState || {});    
    this.availableDice = config.availableDice.map(dConfig => {
      const die = new Dice(0, 0, {
        color: dConfig.color,
        faces: dConfig.faces,
        faceColor: dConfig.faceColor,
        stoppedCallback: this.diceSet.stoppedCallback
      }, null);
      die.setFromSave(dConfig);
      return die;
    });
    this.drawBag = config.drawBag;
    this.rollLock = config.rollLock;
  }

} 

class TableSpot {
  constructor(config) {
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.shape = config.shape || 'circle'; // 'circle' or 'rect'
    this.diameter = config.diameter || 100;
    this.width = config.width || this.diameter;
    this.height = config.height || this.diameter;
    this.radius = config.radius || 20; // Corner radius for rect
    this.bgColor = config.bgColor || '#00000011';
    this.pressedBgColor = config.pressedBgColor || "#66666622";
    this.borderColor = config.borderColor || '#99999933';    
    this.borderWidth = config.borderWidth || 2;
    this.borderType = config.borderType || 'solid'; // 'solid', 'dashed'
    this.title = config.title || '';
    this.titleColor = config.titleColor || '#ffffff';
    this.titleFont = config.titleFont || '16px Thin';
    this.pressed = false;    
    this.onTapCallback = config.onTapCallback
      ? config.onTapCallback.bind(this)
      : null;
    this.onDropCallback = config.onDropCallback
      ? config.onDropCallback.bind(this)
      : null;
    this.heldDice = [];
    this.walled = config.walled !== undefined ? config.walled : false;
  }
  
  addDice( die ) {
    if (!this.heldDice.includes(die)) {
      this.heldDice.push(die);
      die.onSpot = this;
    }
  }

  removeDice( die ) {
    const index = this.heldDice.indexOf(die);
    if (index !== -1) {
      this.heldDice.splice(index, 1);
      die.onSpot = null;
    }
  }

  draw() {
    if (!this.enabled) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw background
    ctx.fillStyle = this.pressed ? this.pressedBgColor : this.bgColor;
    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, this.diameter / 2, 0, PI * 2);
      ctx.fill();
    } else {
      const r = this.radius;
      const w = this.width;
      const h = this.height;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.lineTo(w / 2 - r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, -h / 2 + r, r);
      ctx.lineTo(w / 2, h / 2 - r);
      ctx.arcTo(w / 2, h / 2, w / 2 - r, h / 2, r);
      ctx.lineTo(-w / 2 + r, h / 2);
      ctx.arcTo(-w / 2, h / 2, -w / 2, h / 2 - r, r);
      ctx.lineTo(-w / 2, -h / 2 + r);
      ctx.arcTo(-w / 2, -h / 2, -w / 2 + r, -h / 2, r);
      ctx.closePath();
      ctx.fill();
    }

    // Draw border
    if( this.borderType != 'none' ){
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.borderWidth;
      if (this.borderType === 'dashed') {
        ctx.setLineDash([5, 5]);
      }
      if (this.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, this.diameter / 2, 0, PI * 2);
        ctx.stroke();
      } else {
        const r = this.radius;
        const w = this.width;
        const h = this.height;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + r, -h / 2);
        ctx.lineTo(w / 2 - r, -h / 2);
        ctx.arcTo(w / 2, -h / 2, w / 2, -h / 2 + r, r);
        ctx.lineTo(w / 2, h / 2 - r);
        ctx.arcTo(w / 2, h / 2, w / 2 - r, h / 2, r);
        ctx.lineTo(-w / 2 + r, h / 2);
        ctx.arcTo(-w / 2, h / 2, -w / 2, h / 2 - r, r);
        ctx.lineTo(-w / 2, -h / 2 + r);
        ctx.arcTo(-w / 2, -h / 2, -w / 2 + r, -h / 2, r);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Draw title
    if (this.title) {
      ctx.fillStyle = this.titleColor;
      ctx.font = this.titleFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = this.title.split('\n');
      const lineHeight = parseInt(this.titleFont) * 1.1;
      const spaceHeight = parseInt(this.titleFont) * .1;
      const totalHeight = lines.length * lineHeight - spaceHeight;
      lines.forEach((line, index) => {
        const yOffset = -totalHeight / 2 + index * lineHeight + lineHeight / 2;
        ctx.fillText(line, 0, yOffset);
      });
    }

    ctx.restore();
  }

  isPointInside( x, y ) {
    if (this.shape === 'circle') {
      const dx = x - this.x;
      const dy = y - this.y;
      return Math.hypot(dx, dy) <= this.diameter / 2;
    } else {
      const corners = gt.getRectCornersFromCenter(this.x, this.y, this.width, this.height, 0);
      return gt.pointInRect(x, y, corners);
    }
  }

  handleDown( x, y ) {
    if (!this.enabled || this.onTapCallback==null || !this.isPointInside(x, y)) return false;
    this.pressed = true;
    return true;
  }
  
  handleUp( x, y, heldDice ) {
    if (!this.enabled || !this.isPointInside(x, y)){
      this.pressed = false;
      return false;
    }
    
    if( heldDice.length>0 && heldDice[0].sideLocked && this.onDropCallback ){
      return this.onDropCallback(heldDice);
    }
    
    if(!this.pressed) {
      this.pressed = false;
      return false;
    }
    
    this.pressed = false;
    if (this.isPointInside(x, y) && this.onTapCallback ) {
      this.onTapCallback(this, x, y);
      return true;
    }
    return false;
  }

  toSave() {
    return {
      enabled: this.enabled,      
      heldDice: this.heldDice.map(die => dice.indexOf(die))
    };
  }
  
  setFromSave(config) {
    this.enabled = config.enabled;    
    this.heldDice = config.heldDice
      .filter(index => index >= 0 && index < dice.length)
      .map(index => dice[index]);
    this.heldDice.forEach(die => {
      die.onSpot = this;
    });
  }
}

class GameState {
  constructor() {
    this.states = ['title','start','setup','paused','running','gameover'];
    this.phases = ['waiting','rolling','gathering'];
    this.state = 'title';
    this.currentPhase = 'waiting';
    this.diceRolling=false;
    this.turnNumber = 0;
    this.strikes = 0;
    this.points = 0;
    this.maxStrikes = 3;
  }

  transitionTo(phase) {
    this.currentPhase = phase;
    
    if (phase === 'Start') {
      this.turnNumber++;
      this.diceBag.refill();
      this.inputHandler.throwMode = 'throw';
    } else if (phase === 'End') {
      if (this.strikes >= this.maxStrikes) {
        console.log(`Game Over! Final Score: ${this.points}`);
        // Optionally reset game here
      } else {
        this.transitionTo('Start');
      }
    }
  }

  update(deltaTime) {
    const wasRolling = this.diceRolling;
    this.diceRolling = !dice.every(d => d.isStopped && !d.held);
    if( !this.diceRolling && wasRolling ){
      diceBag.diceSet.allStoppedCallback();
    }    
  }  

  canInteract(touchId) {
    const input = this.inputHandler.inputs.get(touchId);
    if (!input) return true;
    if (this.currentPhase === 'Throw' && input.diceGroup.length > 0) return true;
    if (this.currentPhase === 'Rethrow' && input.diceGroup.every(d => gt.rethrowSpot.isPointInside(d.x, d.y))) return true;
    return this.currentPhase === 'Start' || this.currentPhase === 'Rethrow';
  }

  onDiceStopped(die) {
    if (this.currentPhase !== 'Throw') return;
    const face = die.faces[die.currentSide];
    if (face.includes('O')) {
      this.points++;
    } else if (face.includes('X')) {
      this.strikes++;
    }
    if (dice.every(d => d.isStopped && !d.held)) {
      this.transitionTo('Evaluate');
    }
  }
}

class Players {
  constructor() {
    this.drawMode = 'off';
    this.players = [];
    this.currentPlayerIndex = 0;
    this.winningPlayerIndex = null;
    this.drawMode = 'mini'; // off, mini, full
    this.minTextSize = 20;
    this.fullTextSize = 62;
    this.showHeldDice = false;
    this.showHandScore = false;
    this.opacity = 1;
    this.resetPlayers();
  }
  
  resetPlayers(){
    this.players = [];    
  }
  
  addPlayer(name){
    this.players.push({
      name: name || `Player ${this.players.length+1}`,
      miniName: name ? name.slice(0, 1) : `P${this.players.length+1}`,
      score: 0,
      handScore: 0,
      heldDice: []
    })
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  draw() {
    if (this.drawMode === 'off') {  return;  }
    
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eeeeee';
    ctx.shadowColor = '#000000dd';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    const otherPlayerColor = '#eeeeee';
    const winningColor = '#99ff99';
    const curPlayerColor = gameState.state == 'gameover' ? otherPlayerColor : '#ffee88';
    
    ctx.beginPath(); 
    var curPlayerIndex = Math.max( this.currentPlayerIndex, 0 );
    if (this.drawMode === 'mini') {
      ctx.font = `${this.minTextSize/toTable}px Thin`;
      for (let i = 0; i < this.players.length; i++) {
        const index = (curPlayerIndex + i) % this.players.length;
        const player = this.players[index];
        ctx.fillStyle = (index === this.winningPlayerIndex
          ? winningColor
          : index === this.currentPlayerIndex
            ? curPlayerColor
            : otherPlayerColor
        ) + Math.round(this.opacity * 255).toString(16).padStart(2, '0');
        const name = index === this.currentPlayerIndex ? player.name : player.miniName;
        const text = `${name}: ${player.score}`;
        const y = ((i+.5) * this.minTextSize*1.15)/toTable;
        ctx.fillText(text, 10, y);        
      }
    } else if (this.drawMode === 'full') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${this.fullTextSize/toTable}px Thin`;
      for (let i = 0; i < this.players.length; i++) {
        const index = (curPlayerIndex + i) % this.players.length;
        const player = this.players[index];
        ctx.fillStyle = (index === this.winningPlayerIndex
          ? winningColor
          : index === this.currentPlayerIndex
            ? curPlayerColor
            : otherPlayerColor 
        ) + Math.round(this.opacity * 255).toString(16).padStart(2, '0');
        const text = `${player.name}: ${player.score}`;
        const y = tableHeight / 2 + (i - this.players.length / 2) * 68 / toTable;
        ctx.fillText(text, tableWidth / 2, y);        
      }
    }
    ctx.restore();
  }

  toSave() {
    return {
      players: this.players.map(p => {
        const pCopy = { ...p };
        pCopy.heldDice = pCopy.heldDice.map(d => d.toSave());
        return pCopy;
      }),
      currentPlayerIndex: this.currentPlayerIndex
    };
  }

  setFromSave(config) {
    this.players = config.players.map(p => {
      const pCopy = { ...p };
      pCopy.heldDice = pCopy.heldDice.map(dConfig => {
        const die = new Dice(0, 0, {
          color: dConfig.color,
          faces: dConfig.faces,
          faceColor: dConfig.faceColor,
          strokeColor: dConfig.strokeColor,
          stoppedCallback: diceBag.diceSet.stoppedCallback
        }, null);
        die.setFromSave(dConfig);
        return die;
      });
      return pCopy;
    });
    this.currentPlayerIndex = config.currentPlayerIndex;    
  }  
}

{  // Actions

function addAction( action ){
  action.start();
  actions.push( action );
}

gt.Action = class Action {
  constructor( customUpdate, customStart ) {
    this.done = false;
    this.nextActions = [];
    this.customUpdate = customUpdate;
    this.customStart = customStart;
  }

  addNextAct(action) {
    this.nextActions.push(action);
  }

  start() {
    if (this.customStart) {
      this.customStart();
    }
  }
  
  update(deltaTime) {
    if (this.customUpdate) {
      this.done = this.customUpdate(deltaTime);
    }
    
    if (this.done) {
      this.nextActions.forEach( nextAct=>addAction(nextAct) );
      return true;
    }
    
    return this.done;
  }
}

gt.MoveDiceAct = class MoveDiceAct extends Action {
  constructor(config) {
    super();
    this.die = config.die;
    this.tableSpot = config.tableSpot;
    this.delay = config.delay !== undefined ? config.delay : 0.5;
    this.duration = config.duration !== undefined ? config.duration : 0.7;
    this.elapsed = 0;
    this.die.held = this;
    this.tableSpot.addDice( this.die );  
    this.die.z = 0;
    
    this.setTarget(this.die,this.tableSpot);
  }
  
  setTarget(die, tableSpot) {
    // Calculate target point in TableSpot, avoiding existing dice
    const diceRadius = Dice_Size / 2;
    const clearance = Dice_Size; // Minimum distance from other dice

    // Determine direction toward spot center from die's starting position
    const dx = tableSpot.x - die.x;
    const dy = tableSpot.y - die.y;
    const angle = Math.atan2(dy, dx);

    // Sample candidate points in the spot
    const candidates = [];
    if (tableSpot.shape === 'circle') {
      const maxRadius = (tableSpot.diameter / 2) - diceRadius;
      for (let r = maxRadius * 0.2; r <= maxRadius; r += maxRadius * 0.2) {
        for (let a = angle - PI / 2; a <= angle + PI / 2; a += PI / 8) {
          const x = tableSpot.x + Math.cos(a) * r;
          const y = tableSpot.y + Math.sin(a) * r;
          if (tableSpot.isPointInside(x, y)) {
            candidates.push({ x, y, dist: Math.hypot(x - die.x, y - die.y) });
          }
        }
      }
    } else {
      const width = tableSpot.width - Dice_Size;
      const height = tableSpot.height - Dice_Size;
      const corners = gt.getRectCornersFromCenter(tableSpot.x, tableSpot.y, width, height, 0);
      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));
      for (let x = minX; x <= maxX; x += Dice_Size / 2) {
        for (let y = minY; y <= maxY; y += Dice_Size / 2) {
          if (tableSpot.isPointInside(x, y)) {
            candidates.push({ x, y, dist: Math.hypot(x - die.x, y - die.y) });
          }
        }
      }
    }

    // Filter candidates that are too close to existing dice
    const validCandidates = candidates.filter(candidate => {
      for (let other of dice) {
        if (other === this.die) continue;
        const dist = Math.hypot(candidate.x - other.x, candidate.y - other.y);
        if (dist < clearance) return false;
      }
      return true;
    });

    // Choose the furthest valid candidate, or fallback to spot center
    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => b.dist - a.dist);
      this.targetX = validCandidates[0].x;
      this.targetY = validCandidates[0].y;
    } else {
      this.targetX = tableSpot.x;
      this.targetY = tableSpot.y;
    }

    this.startX = die.x;
    this.startY = die.y;
    this.maxPushDistance = Dice_Size * 0.1; // Further reduced push for minimal bumping
  }

  update(deltaTime) {
    this.elapsed += deltaTime;
    if( this.elapsed < this.delay ){  return;  }
    
    let t = Math.min( (this.elapsed-this.delay) / this.duration, 1);
    let easeT = 1 - Math.pow(1 - t, 2); // Quadratic ease-out

    // Calculate proposed position
    let proposedX = this.startX + (this.targetX - this.startX) * easeT;
    let proposedY = this.startY + (this.targetY - this.startY) * easeT;

    // Check if proposed position is inside the TableSpot and calculate penetration
    const isInside = this.tableSpot.isPointInside(proposedX, proposedY);
    let penetrationRatio = 0;
    if (isInside) {
      if (this.tableSpot.shape === 'circle') {
        const distFromCenter = Math.hypot(proposedX - this.tableSpot.x, proposedY - this.tableSpot.y);
        penetrationRatio = 1 - (distFromCenter / (this.tableSpot.diameter / 2));
      } else {
        const corners = gt.getRectCornersFromCenter(this.tableSpot.x, this.tableSpot.y, this.tableSpot.width, this.tableSpot.height, 0);
        const bounds = this.die.getBounds(corners);
        const minDistX = Math.min(proposedX - bounds.minX, bounds.maxX - proposedX);
        const minDistY = Math.min(proposedY - bounds.minY, bounds.maxY - proposedY);
        const maxDimension = Math.max(this.tableSpot.width, this.tableSpot.height);
        penetrationRatio = Math.min(minDistX, minDistY) / (maxDimension / 2);
      }
    }

    // Slow down based on penetration (more penetration = slower movement)
    const slowdownFactor = isInside ? Math.max(0.3, 1 - penetrationRatio) : 1;
    //easeT *= slowdownFactor;
    proposedX = this.startX + (this.targetX - this.startX) * easeT;
    proposedY = this.startY + (this.targetY - this.startY) * easeT;

    // Handle collisions with other dice
    this.die.x = proposedX;
    this.die.y = proposedY;
    let shouldStop = false;
    for (let other of dice) {
      if (other === this.die) continue;
      const hit = this.die.hitDetect(other);
      if (hit) {
        // // Fuzzy collision: push other die slightly
        // const pushDistance = Math.min(this.maxPushDistance * slowdownFactor, Math.hypot(hit.normalX, hit.normalY));
        // other.x += hit.normalX * pushDistance;
        // other.y += hit.normalY * pushDistance;

        // // Stop if at least 50% into the spot
        // if (isInside && penetrationRatio >= 0.5) {
          // shouldStop = true;
          // break;
        // }        
        shouldStop = true;
      }
    }

    // Finalize position if stopping or at target
    if (shouldStop || t >= 1) {
      this.die.stopRoll(false);
      this.die.held = null;
      this.done = true;
    }

    // Z animation: rise to 1 at halfway, then fall to 0
    const zT = t < 0.5 ? t * 2 : (1 - (t - 0.5) * 2);
    this.die.z = zT * 1;

    return super.update(deltaTime);
  }
}

gt.DelayAct = class DelayAct extends Action {
  constructor(duration = 0.5) {
    super();
    this.duration = duration;
    this.elapsed = 0;
  }  

  update(deltaTime) {
    this.elapsed += deltaTime;
    if (this.elapsed >= this.duration) {
      this.done = true;
    }
    return super.update(deltaTime);
  }
}

gt.TextPopup = class TextPopup {
  constructor(config) {
    this.x = config.x || tableWidth / 2;
    this.y = config.y || tableHeight / 2;
    this.text = config.text || '';
    this.font = config.font || '48px Normal';
    this.textAlign = config.textAlign || 'center';
    this.color = config.color || '#ffffff';
    this.scale = config.scale || 1;
    this.opacity = 1;
    this.holdDuration = config.holdDuration!=undefined ? config.holdDuration : 1;
    this.fadeDuration = config.fadeDuration!=undefined ? config.fadeDuration : 0.5;
    this.elapsed = 0;
    this.bounce = config.bounce || 0;
    this.fadeScale = config.fadeScale!=undefined ? config.fadeScale : .99;
    this.done = false;
  }
  
  update(deltaTime) {
    if (this.done) return;

    this.elapsed += deltaTime;

    if (this.elapsed < this.holdDuration) {
      // Hold phase: full opacity
      this.opacity = 1;
      //this.scale = 1 + this.bounce * Math.sin(this.elapsed * PI * 1.5 );
    } else if (this.elapsed < this.holdDuration + this.fadeDuration) {
      // Fade phase: linear fade out
      const fadeProgress = (this.elapsed - this.holdDuration) / this.fadeDuration;
      this.opacity = 1 - fadeProgress;
      this.scale *=  this.fadeScale;
    } else {
      // Done
      this.done = true;
    }
  }

  draw() {
    if (this.done) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.font = this.font;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round'
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff' + Math.round(this.opacity*.8 * 255).toString(16).padStart(2, '0');
    ctx.fillStyle = this.color + Math.round(this.opacity * 255).toString(16).padStart(2, '0');
    ctx.shadowColor = '#ffffffbb';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.textAlign = this.textAlign;
    ctx.textBaseline = 'middle';    
    
    // Split text into lines
    const lines = this.text.split('\n');
    const lineHeight = parseInt(this.font) * 1.2; // Approximate line height (1.2x font size)
    const totalHeight = lines.length * lineHeight;

    // Draw each line, offset vertically to center the block
    lines.forEach((line, index) => {
      const yOffset = -totalHeight / 2 + (index + 0.5) * lineHeight;      
      //ctx.strokeText(line, 0, yOffset);
      ctx.fillText(line, 0, yOffset);
      
    });
    
    ctx.restore();
  }
}

gt.TextPopupAct = class TextPopupAct extends Action {
  constructor(config) {
    super();
    this.popupConfig = config;
    this.popup = null;
  }
  
  start() {
    this.popup = new TextPopup(this.popupConfig);
    popups.push(this.popup);
  }

  update(deltaTime) {
    this.popup.update(deltaTime);
    
    if (this.popup.done) {
      this.done = true;
      const index = popups.indexOf(this.popup);
      if (index !== -1) {
        popups.splice(index, 1);
      }
    }
    return super.update(deltaTime);
  }
}

gt.ScoreAndNextTurnAct = class NextTurnAct extends Action {
  constructor(config={}) {
    super();
    this.newScore = config.newScore;
    this.endGame = config.endGame;
    this.noTurnChange = config.noTurnChange || false;
    this.winningPlayer = config.winningPlayer;
    this.elapsed = 0;
    this.duration = 2;
    this.startNextCallback = config.startNextCallback;
    
    this.mode = 'wait';
  }  
  
  start() {
    players.drawMode = 'full';
    diceBag.rollLock=true;
    this.mode='start';
    
    if( this.newScore==undefined ){
      this.elapsed += .5;
      this.mode = 'hold1';
    }
  }
    
  update(deltaTime) {
    this.elapsed += deltaTime;

    if (this.mode=='start' && this.elapsed >= .5) {
      if( this.newScore!=undefined ){
        const curPlayer = players.getCurrentPlayer();
        curPlayer.score = this.newScore;
      }
      this.mode='hold1';
    }
    if (this.mode=='hold1' && this.elapsed >= 1) {
      if( this.endGame ){ 
        endGame();
      } else if (!this.noTurnChange) {
        players.nextPlayer();
      }
      if( this.winningPlayer!=undefined ){ 
        players.winningPlayerIndex = this.winningPlayer;
      }
      this.mode='hold2';
    }
    
    if (this.mode=='hold2' && this.elapsed >= 1.5) {
      this.mode='fade';
    }
    
    if (this.mode=='fade' && this.elapsed < this.duration) {
      const fadeProgress = (this.elapsed - 1.5)/.5;
      players.opacity = Math.max(0, 1 - fadeProgress);
    }

    if (this.elapsed >= this.duration) {
      players.drawMode = 'mini';
      players.opacity = 1;
      if (!this.noTurnChange) {
        diceBag.rollLock=false;
        if( this.startNextCallback ){
          this.startNextCallback();
        }
      }
      this.done = true;
    }

    return super.update(deltaTime);
  }
}

}

{  // dice rolling

let mouseDownX = 0;
let mouseDownY = 0;
let mousedownTime = 0;
let mouseThrowSpeed = 0;
let mouseThrowDirection = 0;
let mouseNowX = 0;
let mouseNowY = 0;

const THROW_OSCILLATION_SPEED = 9;
const THROW_MISS_ANGLE = PI/180 * 15;
const FULL_SPEED_DELAY = 0.25;

function updateThrow(x,y){
  mouseNowX = x;
  mouseNowY = y;
  
  positionDiceAroundPoint(heldDice, x, y);
  
  const dx = x - mouseDownX;
  const dy = y - mouseDownY;
  
  mouseThrowDirection = Math.atan2(dy, dx) + PI; // Flip 180
  mouseThrowSpeed = Math.min( Math.hypot(dx, dy) * 10, Max_SPEED) ; // Cap speed   
  
  positionDiceAroundPoint(heldDice, x, y, mouseThrowDirection);
  
  if( mousedownTime==0 && mouseThrowSpeed>9 ){
    mousedownTime = performance.now() / 1000;  }
}

function throwDice(){
  const speedModifier = getSpeedModifier();
  let modifiedSpeed = mouseThrowSpeed * speedModifier;
  modifiedSpeed *= (1 / (1 + GROUP_DICE_SLOW * heldDice.length));
  const modifiedDirection = mouseThrowDirection + THROW_MISS_ANGLE * (1 - speedModifier) * (Math.random() * 2 - 1);
  
  rollDice(heldDice, modifiedSpeed, modifiedDirection);
  
  heldDice = []; 
  mouseThrowSpeed = 0;
  mouseThrowDirection = 0;
}

function drawThrowArrow() {
  if (inputHandler.throwMode !== 'throw') return;

  inputHandler.inputs.forEach((data, touchId) => {
    if (data.diceGroup.length === 0 || !data.throwSpeed) return;
    if( data.diceGroup[0].sideLocked){  return;  }

    ctx.save();
    const lastPos = data.history[data.history.length - 1] || { x: 0, y: 0 };
    ctx.translate(lastPos.x, lastPos.y);
    ctx.rotate(data.throwDirection);

    const speedModifier = inputHandler.getSpeedModifier(data.startTime);
    const modifiedSpeed = data.throwSpeed * speedModifier;

    const arrowLength = modifiedSpeed / 20;
    const arrowWidth = 5 + 5 * speedModifier;

    ctx.strokeStyle = '#99663388';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ffffccaa';
    ctx.beginPath();
    ctx.moveTo(0, -arrowWidth / 2);
    ctx.lineTo(arrowLength, -arrowWidth / 2);
    ctx.lineTo(arrowLength, -arrowWidth);
    ctx.lineTo(arrowLength + arrowWidth, 0);
    ctx.lineTo(arrowLength, arrowWidth);
    ctx.lineTo(arrowLength, arrowWidth / 2);
    ctx.lineTo(0, arrowWidth / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  });
}

function getSpeedModifier() {
  return 1;
  const currentTime = performance.now() / 1000;
  const timeSinceMouseDown = currentTime - mousedownTime;
  if (timeSinceMouseDown <= FULL_SPEED_DELAY) {
    return 1;
  }
  return 0.1 + 0.9 * (Math.cos((timeSinceMouseDown - FULL_SPEED_DELAY) * THROW_OSCILLATION_SPEED) + 1) / 2;
}

}

{ // input - combined mouse and touch

gt.InputHandler = class InputHandler {
  constructor() {
    this.throwMode = 'throw'; // 'flick', 'throw'
    this.inputs = new Map();
    this.MAX_INPUTS = 5;
    this.THROW_OSCILLATION_SPEED = 9;
    this.THROW_MISS_ANGLE = PI / 180 * 15;
    this.FULL_SPEED_DELAY = 0.25;
    this.MIN_SWIPE_DISTANCE = tableWidth * 0.7;
    
    this.setupEventListeners();
  }

  down(x, y, touchId) {
    if (this.inputs.size >= this.MAX_INPUTS && !this.inputs.has(touchId)) return;
    if (!this.inputs.has(touchId)) {
      this.inputs.set(touchId, {
        touchId: touchId,
        history: [],
        diceGroup: [],
        startX: x,
        startY: y,
        startTime: performance.now() / 1000,
        used: false,
        throwSpeed: 0,
        throwDirection: 0
      });
    }
    const input = this.inputs.get(touchId);
    
     if (gameState.state === 'paused') {
      for( let pi=0; pi<pauseMenuButtons.length; pi++ ){
        if (pauseMenuButtons[pi].handleDown(x, y, touchId)) {      
          input.used = true;
          return;
        }
      }
    }
    
    if(['title','start','paused','gameover'].includes(gameState.state)){ return; }
    
    //pause menu
    for( let pi=0; pi<pauseTriggers.length; pi++ ){
      if (pauseTriggers[pi].handleDown(x, y, touchId)) {
        input.used = true;
        return;
      }
    }
    
    //down on spots
    let tableDown = false;
    for( let ti=0; ti<tableSpots.length; ti++ ){
      if( tableSpots[ti].handleDown(x, y) ){
        return;
      }
    };

    //down on dice
    const diceAtPos = getDiceAt(x, y).filter(die => die.speed==0);    
    if (diceAtPos.length > 0) {
      diceInHand( input, diceAtPos );
      return;
    }
    
    //down on table
    if( diceBag.openForRolls() ){      
      const newDice = diceBag.getDice( x, y );
      if( newDice ){
        diceInHand( input, newDice );
      }
    }
    
    this.move(x, y, touchId);
  }

  move(x, y, touchId) {
    const input = this.inputs.get(touchId);
    if (!input || input.diceGroup.length === 0 || input.used) return;
    
    if(['title','start','paused','gameover'].includes(gameState.state)){ return; }
    
    input.history.push({ x, y, time: performance.now() });
    if (input.history.length > 10) input.history.shift();

    let direction;
    if (this.throwMode === 'flick') {
      const centerX = tableWidth / 2;
      const centerY = tableHeight / 2;
      const dx = centerX - x;
      const dy = centerY - y;
      direction = Math.atan2(dy, dx);
    } else {
      const dx = x - input.startX;
      const dy = y - input.startY;
      direction = Math.atan2(dy, dx) + PI;
      input.throwSpeed = Math.min(Math.hypot(dx, dy) * 10, Max_SPEED);
      input.throwDirection = direction;
    }

    positionDiceAroundPoint(input.diceGroup, x, y, direction);
  }

  end(x,y,touchId) {
    const input = this.inputs.get(touchId);    
    this.inputs.delete(touchId);
    
    for( let pi=0; pi<pauseTriggers.length; pi++ ){    
      if (pauseTriggers[pi].handleUp(x, y, touchId)) {
        return;
      }
    }
    
    for( let pi=0; pi<pauseMenuButtons.length; pi++ ){
      if (pauseMenuButtons[pi].handleUp(x, y, touchId)) {      
        input.used = true;
        return;
      }
    }
    
    if (!input || input.used) return;
    
    if (gameState.state === 'title') {
      if( !loadGame() ){
        gameState.state = 'start';
      }      
      return;
    }
    
    if(['gameover'].includes(gameState.state)) {      
      gameState.state = 'start'
      return;
    }
    if (gameState.state === 'start') {
      gameSelector.handleUp(x, y);        
      return;
    }    
    if(gameState.state=='paused'){    
      resumeGame();    
      return;
    }
    
    for( let ti=0; ti<tableSpots.length; ti++ ){
      if( tableSpots[ti].handleUp(x, y, input.diceGroup) ){
        return;
      }
    };
    
    if (input.diceGroup.length === 0) return;

    // // Check for reset swipe
    // const dx = input.history[input.history.length - 1]?.x - input.startX;
    // const duration = (performance.now() / 1000) - input.startTime;
    // if (Math.abs(dx) > this.MIN_SWIPE_DISTANCE && duration < 0.4) {
      // dice.length = 0;
      // diceBag.refill();
      // this.inputs.clear();
      // return;
    // }
    
    
    if( input.diceGroup[0].sideLocked ){
      diceBag.diceSet.dropCallback(input.diceGroup);
    }
   
    if (this.throwMode === 'flick') {
      const recentPositions = input.history;
      let speed = 0;
      let direction = 0;
      if (recentPositions.length > 1) {
        const weights = recentPositions.map((_, i) => i + 1);
        const weightSum = weights.reduce((sum, w) => sum + w, 0);
        let vx = 0, vy = 0;
        for (let i = 1; i < recentPositions.length; i++) {
          const dt = (recentPositions[i].time - recentPositions[i - 1].time) / 1000;
          if (dt <= 0) continue;
          const dx = recentPositions[i].x - recentPositions[i - 1].x;
          const dy = recentPositions[i].y - recentPositions[i - 1].y;
          const weight = weights[i] / weightSum;
          vx += (dx / dt) * weight;
          vy += (dy / dt) * weight;
        }
        speed = Math.hypot(vx, vy);
        direction = Math.atan2(vy, vx);
        speed = Math.min(speed, Max_SPEED);
        speed *= (1 / (1 + GROUP_DICE_SLOW * input.diceGroup.length));
      }
      rollDice(input.diceGroup, speed, direction);
    }
    else {
      let speed = input.throwSpeed || 0;
      let direction = input.throwDirection || 0;
      const speedModifier = this.getSpeedModifier(input.startTime);
      speed *= speedModifier;
      speed *= (1 / (1 + GROUP_DICE_SLOW * input.diceGroup.length));
      direction += this.THROW_MISS_ANGLE * (1 - speedModifier) * (Math.random() * 2 - 1);
      rollDice(input.diceGroup, speed, direction);
    }

  }

  otherDown(x, y, touchId) {
    if (this.inputs.size >= this.MAX_INPUTS && !this.inputs.has(touchId)) return;
    if (!this.inputs.has(touchId)) {
      this.inputs.set(touchId, {
        touchId: touchId,
        history: [],
        diceGroup: [],
        startX: x,
        startY: y,
        startTime: performance.now() / 1000,
        used: false,
        throwSpeed: 0,
        throwDirection: 0
      });
    }
    const input = this.inputs.get(touchId);

    if(['title','start'].includes(gameState.state)){ return; }

    this.move(x, y, touchId);
    
    if( gameState.state == 'paused' ){
      resumeGame();
    }else{
      pauseGame();
    }
  }
  
  setupEventListeners() {
    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        inputHandler.down(e.clientX / toTable, e.clientY / toTable, 'mouse');
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      inputHandler.move(e.clientX / toTable, e.clientY / toTable, 'mouse');
    });

    canvas.addEventListener('mouseup', (e) => {
      inputHandler.move(e.clientX / toTable, e.clientY / toTable, 'mouse');
      inputHandler.end(e.clientX / toTable, e.clientY / toTable,'mouse');
    });

    canvas.addEventListener('mouseleave', (e) => {
      if(! this.inputs.has('mouse')) {  return;  }
      inputHandler.move(e.clientX / toTable, e.clientY / toTable, 'mouse');
      inputHandler.end(e.clientX / toTable, e.clientY / toTable, 'mouse');
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      inputHandler.otherDown(e.clientX / toTable, e.clientY / toTable, 'right_mouse');
    });
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      inputHandler.throwMode = 'flick'; // Default to flick for touch
      for (const touch of e.changedTouches) {
        inputHandler.down(touch.clientX / toTable, touch.clientY / toTable, touch.identifier);
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        inputHandler.move(touch.clientX / toTable, touch.clientY / toTable, touch.identifier);
      }
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        inputHandler.move(touch.clientX / toTable, touch.clientY / toTable, touch.identifier);
        inputHandler.end(touch.clientX / toTable, touch.clientY / toTable,touch.identifier);
      }
    });
  }
  
  getSpeedModifier(startTime) {
    if (1 || this.throwMode !== 'throw') return 1;
    const currentTime = performance.now() / 1000;
    const timeSinceDown = currentTime - startTime;
    if (timeSinceDown <= this.FULL_SPEED_DELAY) return 1;
    return 0.1 + 0.9 * (Math.cos((timeSinceDown - this.FULL_SPEED_DELAY) * this.THROW_OSCILLATION_SPEED) + 1) / 2;
  }

};

gt.PauseTrigger = class PauseTrigger {
  constructor(config) {
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.size = config.size || 80;
    this.position = config.position || 'left';
    this.fillColor = config.fillColor || '#00000011';
    this.strokeColor = config.strokeColor || '#00000022';
    this.strokeWidth = config.strokeWidth || 2;
    this.minSwipeDistance = config.minSwipeDistance || 100;
    this.swipeAngleTolerance = config.swipeAngleTolerance || PI / 4;
    this.trackingTouchId = null;
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.arcBulge = this.size * 0.3;
    
    this.calcPoints();
    
    this.hitBuffer = .35;
  }
  
  calcPoints(x=this.x,y=this.y){
    this.x=x;
    this.y=y
    const halfSize = this.size / 2;
    if (this.position === 'left') {
      this.p1 = { x: this.x, y: this.y };
      this.p2 = { x: this.x + this.size, y: this.y };
      this.p3 = { x: this.x, y: this.y - this.size };
      this.control = { 
        x: this.x + halfSize + this.arcBulge, 
        y: this.y - halfSize - this.arcBulge 
      };
      this.centerX = this.x + this.size *.4;
      this.centerY = this.y - this.size *.4;
    } else {
      this.p1 = { x: this.x, y: this.y };
      this.p2 = { x: this.x - this.size, y: this.y };
      this.p3 = { x: this.x, y: this.y - this.size };
      this.control = { 
        x: this.x - halfSize - this.arcBulge, 
        y: this.y - halfSize - this.arcBulge 
      };
      this.centerX = this.x - this.size *.4;
      this.centerY = this.y - this.size *.4;
    }
  }

  isPointInside(x, y) {
    const area = 0.5 * (-this.p2.y * this.p3.x + this.p1.y * (this.p3.x - this.p2.x) + this.p1.x * (this.p2.y - this.p3.y) + this.p2.x * this.p3.y);
    const s = (this.p1.y * this.p3.x - this.p1.x * this.p3.y + (this.p3.y - this.p1.y) * x + (this.p1.x - this.p3.x) * y) / (2 * area);
    const t = (this.p1.x * this.p2.y - this.p1.y * this.p2.x + (this.p1.y - this.p2.y) * x + (this.p2.x - this.p1.x) * y) / (2 * area);
    const u = 1 - s - t;
    return s >= -this.hitBuffer && t >= -this.hitBuffer && u >= -this.hitBuffer && s + t + u <= 1+this.hitBuffer;
  }

  handleDown(x, y, touchId) {
    if (!this.isPointInside(x, y)) return false;
    this.trackingTouchId = touchId;
    this.startX = x;
    this.startY = y;
    this.startTime = performance.now();
    return true;
  }

  handleUp(x, y, touchId) {
    if (this.trackingTouchId !== touchId) return false;

    this.trackingTouchId = null;
    
    if ( performance.now() - this.startTime < 500 && gameState.state === 'running') {
      pauseGame();
    }
    return true;
  }

  draw() {
    ctx.save();
    ctx.fillStyle = this.fillColor;
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y); // Bottom-left or bottom-right
    ctx.lineTo(this.p2.x, this.p2.y); // Bottom-right or bottom-left
    const arcRadius = this.size * 1.3; // Adjusted for smooth curve
    ctx.arcTo(this.p2.x, this.p2.y, this.control.x, this.control.y, arcRadius);
    // Second arc from midpoint to p3
    ctx.arcTo(this.control.x, this.control.y, this.p3.x, this.p3.y, arcRadius);
    ctx.lineTo(this.p3.x, this.p3.y); // Top point
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.translate( this.centerX, this.centerY );    
    ctx.fillStyle = "#cccccc33";
    drawShape('gear', this.size/2);
    
    ctx.restore();
  }
}

}

{  // misc funcs
function pickFromList(list){
  return list[Math.floor(Math.random() * list.length)];
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
}

lastTime = performance.now();
function update() {
  const currentTime = performance.now();
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.03);
  lastTime = currentTime;

  for( let i=0; i<actions.length; i++ ){
    if( actions[i].update(deltaTime)==true ){
      actions.splice( i, 1 );
      i--;
    }
  }
  gameState.update( deltaTime );
  
  if(['title','start','paused','gameover'].includes(gameState.state)){ return; }
   
  dice.forEach(d => d.update(deltaTime, dice));
   
  diceBag.update( deltaTime );
}

function drawTitle() { 
  ctx.save();
  
  const pausedOffset = -tableHeight / 4;
  ctx.translate(
    tableWidth / 2,
    tableHeight / 2 + (gameState.state=='paused' ? pausedOffset : 0 ));
  ctx.scale( .6,.6);

  // Background
  ctx.fillStyle = '#00000066';
  drawRoundedRect(-380, -75, 760, 120, 20);
  ctx.fill();

  // Text setup
  ctx.font = '190px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffff33';
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round'

  // Measure text to position dice accurately
  let text = 'DMCMR';
  const metrics = ctx.measureText(text);
   text = 'DICER';
  const textWidth = metrics.width;
  const letterWidths = ['D', 'M', 'C', 'M', 'R'].map(char => ctx.measureText(char).width);
  const letters = ['D', 'I', 'C', 'E', 'R']
  const diceSize = 150; // Size for dice representing 'i' and 'e'

  // Calculate starting x to center the title
  let currentX = -textWidth / 2;
  const y = 0;

  // Create dice for 'i' and 'e'
  const standardDieConfig = diceConfigs.find(c => c.name === 'standard 6');
  const iDie = new Dice(0, 0, standardDieConfig, null);
  iDie.faceColor = '#ff3333';
  iDie.currentSide = 2; // Show face '1'
  const eDie = new Dice(0, 0, standardDieConfig, null);
  eDie.currentSide = 5; // Show face '3'
  eDie.faceColor = '#ff3333';
  
  // Store dice positions
  const dicePositions = [];
  
  ['D', 'E', 'C', 'E', 'R']

  // Draw letters first
  text.split('').forEach((char, index) => {
    const xPos = currentX + letterWidths[index] / 2;
    if (char === 'I') {
      dicePositions.push({ die: iDie, x: xPos, y });
    } else if (char === 'E') {
      dicePositions.push({ die: eDie, x: xPos, y });
    } else {
      ctx.strokeText(char, xPos, y);
      ctx.fillText(char, xPos, y);
    }
    currentX += letterWidths[index];
  });

  // Draw dice on top
  dicePositions.forEach(({ die, x, y }) => {
    ctx.save();
    ctx.translate(x, y-18);
    if(die==iDie){
      ctx.rotate(PI / 4);
    }
    die.x = 0;
    die.y = 0;
    die.drawAsIcon(diceSize / gt.Dice_Size);
    ctx.restore();
  });

  ctx.restore();
}

function render() {
  ctx.fillStyle = BG_FILL;
  ctx.fillRect(0, 0, tableWidth, tableHeight);
  
  if(['start','paused'].includes(gameState.state)){
    ctx.fillStyle = '#33333399';
    ctx.fillRect(0, 0, tableWidth, tableHeight);
  }
  
  if (gameState.state === 'start') {
    gameSelector.draw();
    return;
  }
  
  if(diceBag){
    diceBag.diceSet.drawBg();
  }
  
  tableSpots.forEach(spot => spot.draw());
	
  dice.forEach(d => d.draw());
  
  if(diceBag){
    diceBag.diceSet.drawFg();    
    diceBag.draw();
  }
  
  players.draw();

  if(['title','paused'].includes(gameState.state)){
    drawTitle();
  }

  if(['running','gameover'].includes(gameState.state)){
    pauseTriggers.forEach(trigger => trigger.draw());
  }
  
  if (gameState.state === 'paused') {
    pauseMenuButtons.forEach(spot => spot.draw());
  }
  
  drawThrowArrow();
  
  popups.forEach(popup => popup.draw());
  
  // Debug info for most recent dice
  if ( 0 && dice.length > 0) {
    const latestDice = dice[dice.length - 1];
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const debugInfo = [
      `Dice #${dice.length}`,
      `Position: (${latestDice.x.toFixed(1)}, ${latestDice.y.toFixed(1)})`,
      `Z: ${latestDice.z.toFixed(2)}`,
      `Z Speed: ${latestDice.zSpeed.toFixed(2)}`,
      `Speed: ${latestDice.speed.toFixed(1)}`,
      `Direction: ${(latestDice.direction * 180 / PI).toFixed(1)}°`,
      `Rotation: ${(latestDice.rotation * 180 / PI).toFixed(1)}°`,
      `Roll Frame: ${latestDice.rollFrame.toFixed(2)}`,
      `Current Face: ${latestDice.faces[latestDice.currentSide]}`,
      `Stopped: ${latestDice.isStopped}`
    ];
    debugInfo.forEach((line, i) => {
      ctx.fillText(line, 10, 10 + i * 20);
    });
  }
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

{  // init 
 
class GameSelector {
  constructor() {
    this.buttonHeight = 100;
    this.buttonWidth = 300;
    this.spacing = 20;
    this.font = '48px Thin';
    this.bgColor = '#00000066';
    this.textColor = '#ffffff';
    this.borderColor = '#ffffff66';
    this.borderWidth = 3;
    
    this.dicePairs = gamesList.map(game => {
      const diceSet = new gt[game.class]();
      const diceConfigs = diceSet.diceConfigs;      
      const die1 = new Dice(0, 0, diceConfigs[0].config, null);
      die1.size=45;
      die1.pickUp("game_select");
      const die2 = new Dice(0, 0, diceConfigs[diceConfigs.length-1].config, null);
      die2.size=45;
      die2.pickUp("game_select");
      return { die1, die2 };
    });
  }

  draw() {
    ctx.save();
    ctx.translate(tableWidth / 2, tableHeight / 2);
    
    const totalHeight = gamesList.length * this.buttonHeight + (gamesList.length - 1) * this.spacing;
    const startY = -totalHeight / 2;
    const diceOffset = this.buttonWidth / 2;

    gamesList.forEach((game, index) => {
      const y = startY + index * (this.buttonHeight + this.spacing);
      
      // Draw button background
      ctx.fillStyle = game.titleDraw.bg;
      ctx.beginPath();
      drawRoundedRect(
        -this.buttonWidth / 2,
        y - this.buttonHeight / 2,
        this.buttonWidth,
        this.buttonHeight,
        20
      );
      ctx.fill();

      // Draw border
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.borderWidth;
      ctx.stroke();

      // Draw game name
      ctx.fillStyle = this.textColor;
      ctx.font = this.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(game.name, 0, y);
      
      // Update and draw dice
      const dicePair = this.dicePairs[index];
      const deltaTime = 1 / 60; // Approximate frame time for smooth animation
      dicePair.die1.update(deltaTime, []);
      dicePair.die2.update(deltaTime, []);

      // Draw left die
      ctx.save();
      ctx.translate(-diceOffset, y);
      dicePair.die1.x = 0;
      dicePair.die1.y = 0;
      dicePair.die1.draw();
      ctx.restore();

      // Draw right die
      ctx.save();
      ctx.translate(diceOffset, y);
      dicePair.die2.x = 0;
      dicePair.die2.y = 0;
      dicePair.die2.draw();
      ctx.restore();
    });

    ctx.restore();
  }

  handleUp(x, y) {
    const totalHeight = gamesList.length * this.buttonHeight + (gamesList.length - 1) * this.spacing;
    const startY = tableHeight / 2 - totalHeight / 2;

    for (let index = 0; index < gamesList.length; index++) {
      const buttonY = startY + index * (this.buttonHeight + this.spacing);
      const rectCorners = gt.getRectCornersFromCenter(
        tableWidth / 2,
        buttonY,
        this.buttonWidth,
        this.buttonHeight,
        0
      );
      if (gt.pointInRect(x, y, rectCorners)) {
        newGame(gamesList[index].class);
        return;
      }
    }
  }
}

function newGame( gameName, fromLoad ) {
  dice.length = 0;
  heldDice.length = 0;
  tableSpots.length = 0;
  actions.length = 0;
  popups.length = 0;
  
  clearSaveGame();
  
  diceBag = new DiceBag(gameName);
  //diceBag = new DiceBag("Unlimited6s");
  // diceBag = new DiceBag(Poker); 
  players.resetPlayers();  
  diceBag.init();  

  pauseTriggersInit();
  
  if( diceBag.diceSet.playerCount>0 ){
    if( fromLoad==undefined ){
      pnames = shuffleArray(['BoB','Emy']);
      pnames.forEach( name=>players.addPlayer(name) );
      
      players.winningPlayerIndex = null;
      players.drawMode = 'off';
      players.currentPlayerIndex=-1;      
    }
    addAction( new gt.ScoreAndNextTurnAct({ noTurnChange:fromLoad!=undefined } ) );
  }
  
  resumeGame();
}

function endGame() {
  gameState.state = 'gameover';
}

function saveGame() {
  const gameData = {
    dice: dice.map(d => d.toSave()),
    diceBag: diceBag.toSave(),
    tableSpots: tableSpots.map(s => s.toSave()),
    players: players.toSave()
  };
  localStorage.setItem("dicer_save_game", JSON.stringify(gameData));
}

function loadGame() {
  const savedData = localStorage.getItem("dicer_save_game");  
  
  clearSaveGame();
  
  if (!savedData){  return false;  }

  try {
    const gameData = JSON.parse(savedData);

    // Start new game with saved diceSet
    newGame( gameData.diceBag.diceSet, savedData );

    players.setFromSave(gameData.players);
    
    diceBag.setFromSave(gameData.diceBag);
    
    dice.length = 0;
    dice = gameData.dice.map(dConfig => {
      const die = new Dice(0, 0, {
        color: dConfig.color,
        faces: dConfig.faces,
        faceColor: dConfig.faceColor,
        stoppedCallback: diceBag.diceSet.stoppedCallback
      }, null);
      die.setFromSave(dConfig);
      return die;
    });
    
    tableSpots.forEach((spot, index) => {
      const spotConfig = gameData.tableSpots[index];
      if (spotConfig) {
        spot.setFromSave(spotConfig);
      }
    });

    return true;
  } catch (e) {
    console.error('Failed to load game:', e);    
    return false;
  }  
}

function clearSaveGame(){
  localStorage.removeItem("dicer_save_game");
}

function pauseTriggersInit() {
  pauseTriggers.length = 0;
  pauseTriggers.push(new PauseTrigger({
    x: 0,
    y: tableHeight,
    position: 'left',
    size: 80,
    minSwipeDistance: 100,
    swipeAngleTolerance: PI / 4
  }));
  pauseTriggers.push(new PauseTrigger({
    x: tableWidth,
    y: tableHeight,
    position: 'right',
    size: 80,
    minSwipeDistance: 100,
    swipeAngleTolerance: PI / 4
  }));
}
function pauseTriggersLayout() {
  if( pauseTriggers.length==2){   
    pauseTriggers[0].calcPoints(0,tableHeight);
    pauseTriggers[1].calcPoints(tableWidth,tableHeight);    
  }
}

function pauseMenuInit() {
    pauseMenuButtons = [];
    
    const buttonConfig = {
      shape: 'rect',
      bgColor: '#aa5555',
      pressedBgColor: '#aa6666',
      borderColor: '#ffffcc88',      
      borderWidth: 3,
      borderType: 'solid',
      radius: 20,
      titleColor: '#ffff99',
      titleFont: '40px Thin'
    };

    pauseMenuButtons.push(new TableSpot({
      ...buttonConfig,
      title: 'Continue',
      x: tableWidth / 2,
      y: tableHeight / 2,
      width: 440,
      height: 150,      
      onTapCallback: () => {
        resumeGame();
      }
    }));

    pauseMenuButtons.push(new TableSpot({
      ...buttonConfig,
      title: 'Quit',
      titleFont: '32px Thin',
      x: tableWidth / 2 - 140,
      y: tableHeight / 2 + 240,
      width: 160,
      height: 100,
      onTapCallback: () => {
        clearSaveGame();
        
        dice.length = 0;
        heldDice.length = 0;
        tableSpots.length = 0;
        actions.length = 0;
        popups.length = 0;
        diceBag = null;
        players.resetPlayers();
        pauseMenuSpots = [];
        
        gameState.diceRolling=false;
        gameState.state = 'start';
        BG_FILL = DEF_BG_FILL;
      }
    }));

    pauseMenuButtons.push(new TableSpot({
      ...buttonConfig,
      title: 'Restart',
      titleFont: '32px Thin',
      x: tableWidth / 2 + 140,
      y: tableHeight / 2 + 240,
      width: 160,
      height: 100,      
      onTapCallback: () => {        
        newGame(diceBag.diceSet.name);
      }
    }));  
}  pauseMenuInit();
function pauseMenuLayout() {
  pauseMenuButtons[0].x = tableWidth / 2;
  pauseMenuButtons[0].y = tableHeight / 2;
  pauseMenuButtons[1].x = tableWidth / 2 - 140;
  pauseMenuButtons[1].y = tableHeight / 2 + 200;
  pauseMenuButtons[2].x = tableWidth / 2 + 140;
  pauseMenuButtons[2].y = tableHeight / 2 + 200;
}
  
resizeCanvas();

players = new Players();
gameState = new GameState();
inputHandler = new InputHandler();
gameSelector = new GameSelector();

// Start game loop  
gameLoop();

}

{  // test

function testSuits5Hands() {
  // Initialize Poker dice set and bag  
  diceBag = new DiceBag(Poker);
  diceBag.init();
  
  const diceSet = diceBag.diceSet;

  // Initialize hand frequency counter
  const handFrequencies = new Array(diceSet.handOdds.length).fill(0);
  
  const runs = 10000000;

  // Run 1,000,000 simulations
  for (let i = 0; i < runs; i++) {
    if( i % 10000 == 0 ){ console.log( i );  }
    // Draw 5 dice
    const drawnDice = diceBag.getDice(0, 0);

    // Randomly set each die to one of its faces
    drawnDice.forEach(die => {
      die.currentSide = Math.floor(Math.random() * die.faces.length);
      die.sideLocked = true; // Mimic stopped state
    });

    // check best hand per order
    const handResult = diceSet.checkDiceHand(drawnDice);
    handFrequencies[handResult.handi]++;
    
    // // Check all possible hands
    // const handResults = diceSet.checkAllDiceHands(drawnDice);

    // // Increment frequency counter for each matching hand
    // handResults.forEach(result => {
      // handFrequencies[result.handi]++;
    // });

    // Return dice to bag for next iteration
    diceBag.add(drawnDice);
    dice.length = 0; // Clear global dice array
  }

  // Prepare results
  const results = diceSet.handOdds.map(([handName], index) => ({
    hand: handName,
    frequency: handFrequencies[index],
    percentage: (handFrequencies[index] / runs * 100).toFixed(4)
  }));

  // Sort by frequency (descending)
  results.sort((a, b) => b.frequency - a.frequency);
  
   // Build output string
  const output = results.map(({ hand, frequency, percentage }) =>
    `${hand}\t${frequency}\t${percentage}%`
  ).join('\n');

  // Log results
  console.log(`Poker Hand Frequencies (${runs} trials):\n` + output);
}
//testSuits5Hands();


}