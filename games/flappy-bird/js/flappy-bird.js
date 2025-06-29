
class FlappyBirdGame {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.video = null
    this.pose = null
    this.camera = null
    // Game state
    this.gameStarted = false
    this.gameOver = false
    this.score = 0
    this.highScore = this.loadHighScore()
    // Bird properties
    this.bird = {
      x: 100,
      y: 250,
      width: 34,
      height: 24,
      velocity: 0,
      gravity: 0.12, // slower fall for smoother play
      jumpPower: -4.5 // slightly less jump for smoothness
    }
    // Pipes
    this.pipes = []
    // Pipe spacing and speed tweaks for smoother gameplay
    this.pipeWidth = 60;
    this.pipeGap = 210; // larger gap for easier play
    this.pipeSpeed = 1.0; // slower pipes for smoother play
    this.pipeInterval = 140; // more time between pipes
    this.framesSinceLastPipe = 0;
    this.pipeDistance = 300; // more distance between pipes
    // Gesture detection
    this.isHandRaised = false
    this.lastHandRaiseTime = 0
    this.handRaiseCooldown = 250 // milliseconds
    // PNG assets from public/images
    this.backgroundImg = new Image();
    this.backgroundImg.src = '/public/images/background-day.png';
    this.baseImg = new Image();
    this.baseImg.src = '/public/images/base.png';
    this.birdImage = new Image();
    this.birdImage.src = '/public/images/bird.png';
    this.pipeTopImg = new Image();
    this.pipeTopImg.src = '/public/images/pipe-green.png';
    this.pipeBottomImg = new Image();
    this.pipeBottomImg.src = '/public/images/pipe-green.png';
    this.init()
  }
  loadHighScore() {
    const saved = localStorage.getItem('flappyBirdHighScore')
    return saved ? parseInt(saved) : 0
  }
  saveHighScore() {
    localStorage.setItem('flappyBirdHighScore', this.highScore.toString())
  }
  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.saveHighScore()
      return true // New high score!
    }
    return false
  }
  async init() {
    this.setupHTML()
    await this.setupCamera()
    this.setupPoseDetection()
    this.setupGame()
    this.gameLoop()
  }
  setupHTML() {
    document.querySelector('#app').innerHTML = `
      <div id="game-container">
        <canvas id="game-canvas" width="800" height="500"></canvas>
        <video id="webcam" width="200" height="150" autoplay muted></video>
        <canvas id="pose-canvas" width="200" height="150"></canvas>
        <div id="game-ui">
          <div id="score">Score: 0</div>
          <div id="high-score">High Score: ${this.highScore}</div>
          <div id="instructions">
            <p>Raise your hand above your shoulder to jump!</p>
            <p>Super easy - just lift one hand up!</p>
            <p id="status">Initializing camera...</p>
          </div>
        </div>
      </div>
    `
    this.canvas = document.getElementById('game-canvas')
    this.ctx = this.canvas.getContext('2d')
    this.video = document.getElementById('webcam')
    this.poseCanvas = document.getElementById('pose-canvas')
    this.poseCtx = this.poseCanvas.getContext('2d')
  }
  async setupCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      })
      this.video.srcObject = stream
      document.getElementById('status').textContent = 'Camera ready! Setting up pose detection...'
    } catch (error) {
      console.error('Error accessing camera:', error)
      document.getElementById('status').textContent = 'Camera access denied. Please allow camera access.'
    }
  }
  setupPoseDetection() {
    this.pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      }
    })
    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    this.pose.onResults((results) => {
      this.handlePoseResults(results)
    })
    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.pose.send({ image: this.video })
      },
      width: 640,
      height: 480
    })
    this.camera.start()
    document.getElementById('status').textContent = 'Ready to play! Raise your hand to start!'
  }
  handlePoseResults(results) {
    this.poseCtx.clearRect(0, 0, this.poseCanvas.width, this.poseCanvas.height)
    this.poseCtx.drawImage(results.image, 0, 0, this.poseCanvas.width, this.poseCanvas.height)
    if (results.poseLandmarks) {
      const leftWrist = results.poseLandmarks[15]
      const rightWrist = results.poseLandmarks[16]
      this.drawLandmarks([leftWrist, rightWrist])
      // Jump every time a hand is raised (crosses above 60% of the image)
      const handThreshold = 0.6; // 0 = top, 1 = bottom
      const leftHandRaised = leftWrist && leftWrist.y < handThreshold
      const rightHandRaised = rightWrist && rightWrist.y < handThreshold
      const anyHandRaised = leftHandRaised || rightHandRaised
      const currentTime = Date.now()
      if (anyHandRaised && !this.isHandRaised && currentTime - this.lastHandRaiseTime > this.handRaiseCooldown) {
        this.flap()
        this.isHandRaised = true
        this.lastHandRaiseTime = currentTime
      } else if (!anyHandRaised) {
        this.isHandRaised = false
      }
    }
  }
  drawLandmarks(landmarks) {
    this.poseCtx.fillStyle = '#FF0000'
    landmarks.forEach(landmark => {
      if (landmark) {
        const x = landmark.x * this.poseCanvas.width
        const y = landmark.y * this.poseCanvas.height
        this.poseCtx.beginPath()
        this.poseCtx.arc(x, y, 5, 0, 2 * Math.PI)
        this.poseCtx.fill()
      }
    })
  }
  setupGame() {
    this.addPipe()
  }
  flap() {
    if (!this.gameStarted) {
      this.gameStarted = true
      const instructions = document.getElementById('instructions')
      if (instructions) {
        instructions.style.display = 'none'
      }
    }
    if (!this.gameOver) {
      this.bird.velocity = this.bird.jumpPower
    }
  }
  addPipe() {
    const minPipeHeight = 50;
    const maxPipeHeight = this.canvas.height - this.pipeGap - 100;
    const pipeHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
    this.pipes.push({
      x: this.canvas.width,
      topHeight: pipeHeight,
      bottomY: pipeHeight + this.pipeGap,
      bottomHeight: this.canvas.height - (pipeHeight + this.pipeGap),
      passed: false
    });
  }

  update() {
    if (!this.gameStarted || this.gameOver) return;
    this.bird.velocity += this.bird.gravity;
    this.bird.y += this.bird.velocity;

    // Update pipes
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= this.pipeSpeed;
      if (!pipe.passed && pipe.x + this.pipeWidth < this.bird.x) {
        pipe.passed = true;
        this.score++;
        document.getElementById('score').textContent = `Score: ${this.score}`;
      }
      if (pipe.x + this.pipeWidth < 0) {
        this.pipes.splice(i, 1);
      }
      if (this.checkCollision(pipe)) {
        this.gameOver = true;
        const isNewHighScore = this.updateHighScore();
        const message = isNewHighScore
          ? `NEW HIGH SCORE! ${this.score}. Raise hand to restart!`
          : `Game Over! Score: ${this.score}. Raise hand to restart!`;
        document.getElementById('status').textContent = message;
        document.getElementById('high-score').textContent = `High Score: ${this.highScore}`;
      }
    }

    // Add new pipe only if the last pipe is a set distance away
    if (
      this.pipes.length === 0 ||
      (this.pipes[this.pipes.length - 1].x < this.canvas.width - this.pipeDistance)
    ) {
      this.addPipe();
    }

    // Check boundaries (top of screen or hitting the base/floor)
    const baseTop = this.canvas.height - (this.baseImg && this.baseImg.height ? this.baseImg.height : 40);
    if (this.bird.y < 0 || this.bird.y + this.bird.height > baseTop) {
      this.gameOver = true;
      const isNewHighScore = this.updateHighScore();
      const message = isNewHighScore
        ? `NEW HIGH SCORE! ${this.score}. Raise hand to restart!`
        : `Game Over! Score: ${this.score}. Raise hand to restart!`;
      document.getElementById('status').textContent = message;
      document.getElementById('high-score').textContent = `High Score: ${this.highScore}`;
    }
  }
  checkCollision(pipe) {
    const birdLeft = this.bird.x
    const birdRight = this.bird.x + this.bird.width
    const birdTop = this.bird.y
    const birdBottom = this.bird.y + this.bird.height
    const pipeLeft = pipe.x
    const pipeRight = pipe.x + this.pipeWidth
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      if (birdTop < pipe.topHeight || birdBottom > pipe.bottomY) {
        return true
      }
    }
    return false
  }
  draw() {
    // Draw background
    if (this.backgroundImg.complete && this.backgroundImg.naturalWidth > 0) {
      this.ctx.drawImage(this.backgroundImg, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = '#87CEEB';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw pipes
    this.pipes.forEach(pipe => {
      // Top pipe (flipped)
      this.ctx.save();
      this.ctx.scale(1, -1);
      this.ctx.drawImage(this.pipeTopImg, pipe.x, -pipe.topHeight, this.pipeWidth, pipe.topHeight);
      this.ctx.restore();
      // Bottom pipe
      this.ctx.drawImage(this.pipeBottomImg, pipe.x, pipe.bottomY, this.pipeWidth, pipe.bottomHeight);
    });

    // Draw base
    if (this.baseImg.complete && this.baseImg.naturalWidth > 0) {
      this.ctx.drawImage(this.baseImg, 0, this.canvas.height - this.baseImg.height, this.canvas.width, this.baseImg.height);
    } else {
      this.ctx.fillStyle = '#deb887';
      this.ctx.fillRect(0, this.canvas.height - 40, this.canvas.width, 40);
    }

    // Draw bird
    if (this.birdImage.complete && this.birdImage.naturalWidth > 0) {
      this.ctx.drawImage(this.birdImage, this.bird.x, this.bird.y, this.bird.width, this.bird.height);
    } else {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fillRect(this.bird.x, this.bird.y, this.bird.width, this.bird.height);
    }

    // Draw overlays, score, etc.
    if (this.gameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      this.ctx.fillStyle = 'white'
      this.ctx.font = '48px Arial'
      this.ctx.textAlign = 'center'
      this.ctx.fillText('Game Over', this.canvas.width / 2, this.canvas.height / 2 - 50)
      this.ctx.font = '24px Arial'
      this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2)
      this.ctx.fillText('Raise your hand to restart!', this.canvas.width / 2, this.canvas.height / 2 + 50)
    }
    if (!this.gameStarted) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      this.ctx.fillStyle = 'white'
      this.ctx.font = '32px Arial'
      this.ctx.textAlign = 'center'
      this.ctx.fillText('Gesture Flappy Bird', this.canvas.width / 2, this.canvas.height / 2 - 50)
      this.ctx.font = '18px Arial'
      this.ctx.fillText('Raise your hand to start!', this.canvas.width / 2, this.canvas.height / 2 + 20)
    }
  }
  restart() {
    if (this.gameOver) {
      this.gameOver = false
      this.gameStarted = false
      this.score = 0
      this.bird.y = 250
      this.bird.velocity = 0
      this.pipes = []
      this.addPipe()
      document.getElementById('score').textContent = 'Score: 0'
      document.getElementById('status').textContent = 'Ready to play! Raise your hand to start!'
      const instructions = document.getElementById('instructions')
      if (instructions) {
        instructions.style.display = 'block'
      }
    }
  }
  gameLoop() {
    this.update()
    this.draw()
    if (this.gameOver && this.isHandRaised) {
      this.restart()
    }
    requestAnimationFrame(() => this.gameLoop())
  }
}
// Start the game
new FlappyBirdGame()
