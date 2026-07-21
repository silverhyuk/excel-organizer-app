import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, X } from 'lucide-react';

import baldDancerImg from '../assets/bald_dancer.jpg';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HEART_SCORE,
  PLAYER_SIZE,
  calculateScore,
  createBomb,
  createHeart,
  getHeartSpawnInterval,
  getSpawnInterval,
  movePlayer,
  resolveFallingItemCollisions
} from '../utils/dodgeGame';

const HIGH_SCORE_KEY = 'excel_organizer_bald_dodge_high_score';

function createInitialGame() {
  return {
    player: {
      x: (GAME_WIDTH - PLAYER_SIZE) / 2,
      y: GAME_HEIGHT - PLAYER_SIZE - 28,
      size: PLAYER_SIZE
    },
    items: [],
    elapsed: 0,
    lastBombSpawn: 0,
    lastHeartSpawn: 0,
    dodged: 0,
    heartsCollected: 0,
    score: 0
  };
}

function drawBackground(context, elapsed) {
  const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, '#11182b');
  gradient.addColorStop(1, '#070a12');
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = '#6ee7f2';
  context.lineWidth = 1;
  const offset = (elapsed / 32) % 40;
  for (let y = -40 + offset; y < GAME_HEIGHT; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(GAME_WIDTH, y);
    context.stroke();
  }
  for (let x = 0; x <= GAME_WIDTH; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, GAME_HEIGHT);
    context.stroke();
  }
  context.restore();

  const spotlight = context.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT, 30, GAME_WIDTH / 2, GAME_HEIGHT, 360);
  spotlight.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
  spotlight.addColorStop(1, 'rgba(139, 92, 246, 0)');
  context.fillStyle = spotlight;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawFallingItem(context, item) {
  const center = item.size / 2;
  context.save();
  context.translate(item.x + center, item.y + center);
  context.rotate(item.angle);

  if (item.type === 'heart') {
    context.shadowBlur = 22;
    context.shadowColor = '#fb7185';
    context.fillStyle = '#f43f5e';
    context.beginPath();
    context.moveTo(0, center * 0.82);
    context.bezierCurveTo(-center * 1.08, center * 0.14, -center * 0.9, -center * 0.72, -center * 0.35, -center * 0.72);
    context.bezierCurveTo(-center * 0.08, -center * 0.72, 0, -center * 0.5, 0, -center * 0.3);
    context.bezierCurveTo(0, -center * 0.5, center * 0.08, -center * 0.72, center * 0.35, -center * 0.72);
    context.bezierCurveTo(center * 0.9, -center * 0.72, center * 1.08, center * 0.14, 0, center * 0.82);
    context.closePath();
    context.fill();
    context.strokeStyle = '#fecdd3';
    context.lineWidth = 2;
    context.stroke();
  } else {
    context.shadowBlur = 20;
    context.shadowColor = '#f97316';
    context.fillStyle = '#171923';
    context.beginPath();
    context.arc(0, center * 0.12, center * 0.72, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#6b7280';
    context.lineWidth = 2;
    context.stroke();

    context.strokeStyle = '#d6a85f';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(center * 0.28, -center * 0.48);
    context.quadraticCurveTo(center * 0.38, -center * 0.92, center * 0.75, -center * 0.84);
    context.stroke();

    context.fillStyle = '#fff';
    context.globalAlpha = 0.35;
    context.beginPath();
    context.arc(-center * 0.25, -center * 0.12, center * 0.17, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = '#fb923c';
    context.beginPath();
    context.arc(center * 0.78, -center * 0.86, 4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPlayer(context, player, image, elapsed) {
  const center = player.size / 2;
  const danceAngle = Math.sin(elapsed / 115) * 0.09;
  const bounce = Math.sin(elapsed / 85) * 3;
  context.save();
  context.translate(player.x + center, player.y + center + bounce);
  context.rotate(danceAngle);
  context.shadowBlur = 25;
  context.shadowColor = '#f9d56e';
  context.beginPath();
  context.arc(0, 0, center, 0, Math.PI * 2);
  context.clip();
  if (image?.complete) {
    context.drawImage(image, -center, -center, player.size, player.size);
  } else {
    context.fillStyle = '#f9d56e';
    context.fill();
  }
  context.restore();

  context.save();
  context.translate(player.x + center, player.y + center + bounce);
  context.rotate(danceAngle);
  context.strokeStyle = '#fff4bd';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, center - 2, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawScene(canvas, game, image) {
  const context = canvas?.getContext('2d');
  if (!context) return;
  drawBackground(context, game.elapsed);
  game.items.forEach(item => drawFallingItem(context, item));
  drawPlayer(context, game.player, image, game.elapsed);
}

export default function BaldDodgeGame({ onClose }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const gameRef = useRef(createInitialGame());
  const directionsRef = useRef({ up: false, down: false, left: false, right: false });
  const [phase, setPhase] = useState('ready');
  const [score, setScore] = useState(0);
  const [heartsCollected, setHeartsCollected] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  const startGame = useCallback(() => {
    directionsRef.current = { up: false, down: false, left: false, right: false };
    gameRef.current = createInitialGame();
    setScore(0);
    setHeartsCollected(0);
    setPhase('playing');
  }, []);

  const setDirection = useCallback((direction, active) => {
    directionsRef.current[direction] = active;
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = baldDancerImg;
    image.onload = () => drawScene(canvasRef.current, gameRef.current, image);
    imageRef.current = image;
    drawScene(canvasRef.current, gameRef.current, image);
  }, []);

  useEffect(() => {
    const controlMap = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right'
    };
    const handleKeyDown = event => {
      const direction = controlMap[event.code];
      if (direction) {
        event.preventDefault();
        setDirection(direction, true);
      }
      if ((event.code === 'Space' || event.code === 'Enter') && phase !== 'playing') {
        event.preventDefault();
        startGame();
      }
    };
    const handleKeyUp = event => {
      const direction = controlMap[event.code];
      if (direction) {
        event.preventDefault();
        setDirection(direction, false);
      }
    };
    const releaseDirections = () => {
      directionsRef.current = { up: false, down: false, left: false, right: false };
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerup', releaseDirections);
    window.addEventListener('blur', releaseDirections);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerup', releaseDirections);
      window.removeEventListener('blur', releaseDirections);
    };
  }, [phase, setDirection, startGame]);

  useEffect(() => {
    if (phase !== 'playing') {
      drawScene(canvasRef.current, gameRef.current, imageRef.current);
      return undefined;
    }

    const game = gameRef.current;
    let animationFrame;
    let lastTime = performance.now();
    const animate = now => {
      const deltaSeconds = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      game.elapsed += deltaSeconds * 1000;
      game.player = movePlayer(game.player, directionsRef.current, deltaSeconds);

      if (game.elapsed - game.lastBombSpawn >= getSpawnInterval(game.elapsed)) {
        game.items.push(createBomb(game.elapsed));
        game.lastBombSpawn = game.elapsed;
      }

      if (game.elapsed - game.lastHeartSpawn >= getHeartSpawnInterval(game.elapsed)) {
        game.items.push(createHeart(game.elapsed));
        game.lastHeartSpawn = game.elapsed;
      }

      game.items.forEach(item => {
        item.y += item.speed * deltaSeconds;
        item.angle += item.spin * deltaSeconds;
      });
      const visibleItems = [];
      for (const item of game.items) {
        if (item.y > GAME_HEIGHT + item.size) {
          if (item.type === 'bomb') game.dodged += 1;
        } else {
          visibleItems.push(item);
        }
      }

      const collision = resolveFallingItemCollisions(game.player, visibleItems);
      game.items = collision.remainingItems;
      if (collision.heartsCollected > 0) {
        game.heartsCollected += collision.heartsCollected;
        setHeartsCollected(game.heartsCollected);
      }
      game.score = calculateScore(game.elapsed, game.dodged, game.heartsCollected);
      setScore(current => current === game.score ? current : game.score);

      drawScene(canvasRef.current, game, imageRef.current);
      if (collision.bombHit) {
        setHighScore(current => {
          const next = Math.max(current, game.score);
          try {
            localStorage.setItem(HIGH_SCORE_KEY, String(next));
          } catch {
            // The game still works when storage is unavailable.
          }
          return next;
        });
        setPhase('gameover');
        return;
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [phase]);

  const directionButton = (direction, label, Icon) => (
    <button
      className={`dodge-control dodge-control-${direction}`}
      aria-label={label}
      onPointerDown={event => {
        event.preventDefault();
        setDirection(direction, true);
      }}
      onPointerUp={() => setDirection(direction, false)}
      onPointerLeave={() => setDirection(direction, false)}
    >
      <Icon size={22} />
    </button>
  );

  return (
    <div className="bald-dodge-shell" role="dialog" aria-modal="true" aria-label="빡빡이 닷지 게임">
      <div className="bald-dodge-header">
        <div>
          <span className="bald-dodge-eyebrow">SECRET GAME</span>
          <h1>빡빡이 닷지</h1>
        </div>
        <div className="bald-dodge-scoreboard">
          <span>점수 <strong>{score.toLocaleString()}</strong></span>
          <span>하트 <strong>❤️ {heartsCollected}</strong></span>
          <span>최고 <strong>{highScore.toLocaleString()}</strong></span>
        </div>
        <button className="bald-dodge-close" onClick={onClose} aria-label="게임 닫기">
          <X size={20} />
        </button>
      </div>

      <div className="bald-dodge-stage">
        <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} aria-label="폭탄을 피하고 하트를 모으는 게임 화면" />
        {phase === 'ready' && (
          <div className="bald-dodge-message">
            <span className="bald-dodge-message-icon">🕺</span>
            <h2>댄스 플로어를 지켜라!</h2>
            <p>폭탄은 피하고 하트를 모으세요. 하트 하나당 +{HEART_SCORE}점!</p>
            <button onClick={startGame}>게임 시작 <small>SPACE</small></button>
          </div>
        )}
        {phase === 'gameover' && (
          <div className="bald-dodge-message game-over">
            <span className="bald-dodge-message-icon">💥</span>
            <h2>댄스 종료!</h2>
            <p>최종 점수 <strong>{score.toLocaleString()}</strong></p>
            <button onClick={startGame}><RotateCcw size={17} /> 다시 도전 <small>SPACE</small></button>
          </div>
        )}
      </div>

      <div className="bald-dodge-footer">
        <p><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 또는 WASD로 이동 · ❤️ +{HEART_SCORE}점 · <kbd>⌘G</kbd>/<kbd>Ctrl+G</kbd>로 종료</p>
        <div className="dodge-controls" aria-label="터치 이동 컨트롤">
          {directionButton('up', '위로 이동', ArrowUp)}
          {directionButton('left', '왼쪽으로 이동', ArrowLeft)}
          {directionButton('down', '아래로 이동', ArrowDown)}
          {directionButton('right', '오른쪽으로 이동', ArrowRight)}
        </div>
      </div>
    </div>
  );
}
