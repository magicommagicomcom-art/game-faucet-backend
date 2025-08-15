// -----------------------------
// Konfigurasi Backend & API Key
// -----------------------------
const API_URL = "https://game-faucet-backend.vercel.app/api/claim";
const API_KEY = "mygamefaucet_2025_secret_#98as";

// -----------------------------
// Fungsi Kirim Klaim ke Backend
// -----------------------------
async function sendClaimToServer(wallet, score) {
  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({
        wallet: wallet,
        score: score
      })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Claim failed");

    alert(`✅ Claim sukses! TX: ${data.txHash}`);
  } catch (err) {
    alert("❌ Claim error: " + err.message);
  }
}

// -----------------------------
// Scene Start Menu
// -----------------------------
class StartMenuScene extends Phaser.Scene {
    constructor() { super('StartMenu'); }
    preload() {
        this.load.image('startBg', 'assets/background.png');
        this.load.image('startBtn', 'assets/start-button.png');
    }
    create() {
        this.add.image(this.scale.width / 2, this.scale.height / 2, 'startBg')
            .setDisplaySize(this.scale.width, this.scale.height);

        let startButton = this.add.image(this.scale.width / 2, this.scale.height / 2 + 50, 'startBtn')
            .setInteractive()
            .setScale(1);

        let startButtonY = this.scale.height / 2 + 50;
        let baseY = startButtonY - 80; 

        let titleEth = this.add.text(this.scale.width / 2 + 50, baseY, 'Eth', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '80px',
            fontStyle: 'bold',
            fill: '#000000', 
            stroke: '#8B4513',
            strokeThickness: 6
        }).setOrigin(1, 0.5);

        let titleOS = this.add.text(this.scale.width / 2 + 50, baseY, 'OS', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '80px',
            fontStyle: 'bold',
            fill: '#7393e0', 
            stroke: '#8B4513',
            strokeThickness: 6
        }).setOrigin(0, 0.5);

        this.tweens.add({
            targets: [titleEth, titleOS],
            y: baseY - 5,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        startButton.on('pointerover', () => {
            this.tweens.add({ targets: startButton, scale: 1.1, duration: 200 });
        });
        startButton.on('pointerout', () => {
            this.tweens.add({ targets: startButton, scale: 1, duration: 200 });
        });

        startButton.on('pointerdown', () => {
            let wallet = prompt("Masukkan alamat wallet MON Anda:");
            if (!wallet || wallet.trim() === "") {
                alert("Alamat wallet tidak boleh kosong!");
                return;
            }
            this.scene.start('GameScene', { wallet: wallet });
        });

        this.add.text(this.scale.width / 2, this.scale.height - 50, 'Swipe atau gunakan tombol panah untuk bermain', {
            fontSize: '18px',
            fill: '#fff'
        }).setOrigin(0.5);
    }
}

// -----------------------------
// Scene Game
// -----------------------------
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    init(data) {
        this.playerWallet = data.wallet || "";
    }
    preload() {
        this.load.image('head', 'assets/worm-head.png');
        this.load.image('body', 'assets/worm-body.png');
        this.load.image('tail', 'assets/worm-body.png');
        this.load.image('food', 'assets/food.png');
        this.load.image('background', 'assets/background.png');
    }
    create() {
        this.add.image(this.scale.width / 2, this.scale.height / 2, 'background')
            .setDisplaySize(this.scale.width, this.scale.height);

        this.cellSize = 30;
        this.speed = this.cellSize;
        this.direction = 'RIGHT';
        this.nextDirection = 'RIGHT';
        this.moveTimer = 0;
        this.scoreMON = 0;
        this.alive = true;

        const startX = Math.floor(this.scale.width / (2 * this.cellSize)) * this.cellSize;
        const startY = Math.floor(this.scale.height / (2 * this.cellSize)) * this.cellSize;

        this.snake = [];
        let head = this.add.sprite(startX, startY, 'head').setDepth(1);
        let body1 = this.add.sprite(startX - this.cellSize, startY, 'body');
        let tail = this.add.sprite(startX - this.cellSize * 2, startY, 'tail');
        this.snake.push(head, body1, tail);

        this.food = this.add.sprite(0, 0, 'food');
        this.placeFood();

        this.scoreText = this.add.text(10, 10, 'MON: 0', { 
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '24px', 
            fill: '#fff', 
            stroke: '#8B4513',
            strokeThickness: 6
        });

        this.cursors = this.input.keyboard.createCursorKeys();

        this.input.on('pointerdown', (pointer) => {
            this.startX = pointer.x;
            this.startY = pointer.y;
        });
        this.input.on('pointerup', (pointer) => {
            let dx = pointer.x - this.startX;
            let dy = pointer.y - this.startY;
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0 && this.direction !== 'LEFT') this.nextDirection = 'RIGHT';
                else if (dx < 0 && this.direction !== 'RIGHT') this.nextDirection = 'LEFT';
            } else {
                if (dy > 0 && this.direction !== 'UP') this.nextDirection = 'DOWN';
                else if (dy < 0 && this.direction !== 'DOWN') this.nextDirection = 'UP';
            }
        });
    }

    update(time) {
        if (!this.alive) return;

        if (this.cursors.left.isDown && this.direction !== 'RIGHT') this.nextDirection = 'LEFT';
        else if (this.cursors.right.isDown && this.direction !== 'LEFT') this.nextDirection = 'RIGHT';
        else if (this.cursors.up.isDown && this.direction !== 'DOWN') this.nextDirection = 'UP';
        else if (this.cursors.down.isDown && this.direction !== 'UP') this.nextDirection = 'DOWN';

        if (time > this.moveTimer) {
            this.moveTimer = time + 150;
            this.direction = this.nextDirection;
            this.moveSnake();
        }
    }

    moveSnake() {
        let head = this.snake[0];
        let newX = head.x;
        let newY = head.y;

        if (this.direction === 'LEFT') newX -= this.speed;
        else if (this.direction === 'RIGHT') newX += this.speed;
        else if (this.direction === 'UP') newY -= this.speed;
        else if (this.direction === 'DOWN') newY += this.speed;

        if (newX < 0 || newX >= this.scale.width || newY < 0 || newY >= this.scale.height) {
            this.gameOver();
            return;
        }

        for (let i = this.snake.length - 1; i > 0; i--) {
            this.snake[i].x = this.snake[i - 1].x;
            this.snake[i].y = this.snake[i - 1].y;
            this.snake[i].angle = this.snake[i - 1].angle;
        }

        head.x = newX;
        head.y = newY;
        head.setDepth(1);

        if (this.direction === 'LEFT') head.angle = 180;
        else if (this.direction === 'RIGHT') head.angle = 0;
        else if (this.direction === 'UP') head.angle = -90;
        else if (this.direction === 'DOWN') head.angle = 90;

        for (let i = 1; i < this.snake.length; i++) {
            this.snake[i].angle = this.snake[i - 1].angle;
        }

        for (let i = 1; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                this.gameOver();
                return;
            }
        }

        if (head.x === this.food.x && head.y === this.food.y) {
            let newSegment = this.add.sprite(
                this.snake[this.snake.length - 1].x,
                this.snake[this.snake.length - 1].y,
                'body'
            );
            this.snake.push(newSegment);
            this.scoreMON = Math.min(5, this.scoreMON + 0.1);
            this.scoreText.setText('MON: ' + this.scoreMON.toFixed(1));
            this.placeFood();

            if (this.scoreMON >= 5) {
                this.gameOver();
                return;
            }
        }
    }

    placeFood() {
        let validPos = false;
        while (!validPos) {
            let foodX = Math.floor(Phaser.Math.Between(0, this.scale.width - this.cellSize) / this.cellSize) * this.cellSize;
            let foodY = Math.floor(Phaser.Math.Between(0, this.scale.height - this.cellSize) / this.cellSize) * this.cellSize;

            validPos = true;
            for (let segment of this.snake) {
                if (segment.x === foodX && segment.y === foodY) {
                    validPos = false;
                    break;
                }
            }
            if (validPos) {
                this.food.x = foodX;
                this.food.y = foodY;
            }
        }
    }

    gameOver() {
        this.alive = false;
        if (this.scoreMON > 0 && this.playerWallet) {
            sendClaimToServer(this.playerWallet, this.scoreMON);
        }
        this.scene.start('GameOverScene', { score: this.scoreMON });
    }
}

class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    init(data) { this.finalScore = data.score; }
    preload() {
        this.load.image('bg', 'assets/background.png');
        this.load.image('restartBtn', 'assets/restart-button.png');
        this.load.image('menuBtn', 'assets/start-button.png');
    }
    create() {
        this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg')
            .setDisplaySize(this.scale.width, this.scale.height)
            .setAlpha(0.5); 

        let title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 150, 'GAME OVER', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '64px',
            fontStyle: 'bold',
            fill: '#f00',
            stroke: '#000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        this.add.text(this.scale.width / 2, this.scale.height / 2 - 50,
            `MON: ${this.finalScore.toFixed(1)}`, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '28px',
                fill: '#fff',
                align: 'center'
            }).setOrigin(0.5);

        let restartButton = this.add.image(this.scale.width / 2, this.scale.height / 2 + 50, 'restartBtn')
            .setInteractive();
        restartButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        let menuButton = this.add.image(this.scale.width / 2, this.scale.height / 2 + 150, 'menuBtn')
            .setInteractive();
        menuButton.on('pointerdown', () => {
            this.scene.start('StartMenu');
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    scene: [StartMenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
