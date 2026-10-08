import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, ContactShadows } from '@react-three/drei';
import {
  CanvasTexture,
  CatmullRomCurve3,
  Group,
  PMREMGenerator,
  Shape,
  SRGBColorSpace,
  Vector3,
} from 'three';
import {
  HORSE_COLORS,
  type GameView,
  type HorseView,
  type Language,
  type BoardTheme,
} from './shared/types';
import { strings } from './i18n';
import { getBoardTheme, themeVariables, type BoardThemeDesign } from './themes';
import { HorseSculpture } from './HorseSculpture';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const trackPoint = (position: number, length: number, offset = 0) => {
  const angle = (position / length) * Math.PI * 2 + Math.PI / 2;
  return new Vector3(Math.cos(angle) * (6 + offset), 0.13, Math.sin(angle) * (3.55 + offset));
};
function useLabelTexture(text: string, theme: BoardThemeDesign, badge = false) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    if (badge) {
      ctx.beginPath();
      ctx.arc(128, 128, 106, 0, Math.PI * 2);
      ctx.fillStyle = theme.card;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = theme.metal;
      ctx.stroke();
    }
    ctx.fillStyle = badge ? theme.cardInk : theme.label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '100px Georgia';
    ctx.fillText(text, 128, 132);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [text, badge, theme]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
function TrackLabel({ value, theme }: { value: number; theme: BoardThemeDesign }) {
  const texture = useLabelTexture(String(value), theme);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.27, 0.27]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
function useSurfaceTexture(theme: BoardThemeDesign, frame = false) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = frame ? theme.frame : theme.field;
    ctx.fillRect(0, 0, 512, 512);
    // Deterministic handmade material textures need no external asset requests.
    let seed = 1709;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    if (frame && theme.id === 'royal-club') {
      for (let y = 0; y < 512; y += 2) {
        ctx.beginPath();
        ctx.strokeStyle = y % 4 ? '#34231944' : '#bf8f5638';
        ctx.lineWidth = 0.6 + random() * 1.7;
        for (let x = 0; x <= 512; x += 8) {
          const dy = Math.sin(x / 72 + y / 36) * 7 + Math.sin(x / 27 + y / 90) * 3;
          if (!x) ctx.moveTo(x, y + dy);
          else ctx.lineTo(x, y + dy);
        }
        ctx.stroke();
      }
    } else if (theme.id === 'nocturne') {
      for (let n = 0; n < (frame ? 18 : 8); n++) {
        ctx.beginPath();
        ctx.strokeStyle = frame ? '#c4c5bd18' : '#c4c5bd0b';
        ctx.lineWidth = random() * 0.9 + 0.2;
        let x = random() * 512,
          y = random() * 512;
        ctx.moveTo(x, y);
        for (let i = 0; i < 13; i++) {
          x += random() * 48 - 12;
          y += random() * 45 - 16;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (!frame && theme.id === 'imperial-porcelain') {
      ctx.strokeStyle = '#2039580b';
      ctx.lineWidth = 1;
      for (let x = 0; x <= 512; x += 64) {
        for (let y = 0; y <= 512; y += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y - 24);
          ctx.quadraticCurveTo(x + 24, y, x, y + 24);
          ctx.quadraticCurveTo(x - 24, y, x, y - 24);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 16000; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff06' : '#00000007';
      ctx.fillRect(random() * 512, random() * 512, 1, frame ? 1 : 2);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [theme, frame]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
function FeltMark({ theme }: { theme: BoardThemeDesign }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = theme.id === 'imperial-porcelain' ? theme.frame : theme.metal;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.font = '40px Georgia';
    ctx.fillText('R O Y A L   T U R F', 512, 101);
    ctx.font = theme.id === 'imperial-porcelain' ? '49px Georgia' : '61px Georgia';
    ctx.fillText(theme.name.en.toUpperCase(), 512, 193);
    ctx.font = '19px sans-serif';
    ctx.fillText('T H E   R A C I N G   C O L L E C T I O N', 512, 253);
    ctx.beginPath();
    ctx.moveTo(280, 290);
    ctx.lineTo(744, 290);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(512 + side * 364, 149);
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(0, 105);
      ctx.quadraticCurveTo(76, 0, 0, -108);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 7 - 0.5) * 2.4;
        ctx.save();
        ctx.translate(Math.cos(angle) * 40, Math.sin(angle) * 95);
        ctx.rotate(-angle * 0.7);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 19, 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [theme]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0.036, -1.72]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5.4, 1.65]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.95} />
    </mesh>
  );
}
class CanvasGuard extends Component<
  { children: ReactNode; fallback: ReactNode },
  { broken: boolean }
> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    return this.state.broken ? this.props.fallback : this.props.children;
  }
}
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    }
  } catch {
    /* Render the accessible 2D table below. */
  }
  return false;
}
function StudioReflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const studio = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(studio, 0.04);
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.4;
    studio.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      environment.dispose();
    };
  }, [gl, scene]);
  return null;
}
function Camera({ overhead }: { overhead: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    if (overhead) camera.position.set(0, Math.max(18, 25.6 / aspect), 0.01);
    else
      camera.position.copy(
        new Vector3(11, 14, 15).normalize().multiplyScalar(24.8 * Math.max(1, 1.22 / aspect)),
      );
    camera.lookAt(0, 0, 0);
  }, [camera, overhead, size.width, size.height]);
  return (
    <OrbitControls
      target={[0, 0, 0]}
      enablePan={false}
      enableZoom
      minDistance={13}
      maxDistance={48}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2.5}
    />
  );
}
function Horse({
  id,
  horse,
  length,
  onSelect,
  reduced,
  preview,
  lane,
  theme,
}: {
  id: number;
  horse?: HorseView;
  length: number;
  onSelect: (id: number) => void;
  reduced: boolean;
  preview: boolean;
  lane: number;
  theme: BoardThemeDesign;
}) {
  const group = useRef<Group>(null);
  const numberTexture = useLabelTexture(String(id + 1), theme, true);
  const previewPosition = -id * 1.15;
  const progress = useRef(horse?.position ?? previewPosition);
  useEffect(() => {
    progress.current = horse?.position ?? previewPosition;
  }, [horse?.cardId]);
  const target = useMemo(
    () =>
      horse?.rank
        ? new Vector3(
            horse.rank === 1 ? 0 : horse.rank === 2 ? -1.7 : 1.7,
            horse.rank === 1 ? 0.4 : horse.rank === 2 ? 0.31 : 0.25,
            -0.5,
          )
        : trackPoint(horse?.position ?? previewPosition, length, preview ? -0.08 * id : lane),
    [horse?.position, horse?.rank, id, length, preview, lane],
  );
  useFrame((_, delta) => {
    if (group.current) {
      if (horse?.rank) group.current.position.lerp(target, reduced ? 1 : 1 - Math.exp(-delta * 5));
      else {
        const destination = horse?.position ?? previewPosition;
        progress.current +=
          (destination - progress.current) * (reduced ? 1 : 1 - Math.exp(-delta * 5));
        group.current.position.copy(
          trackPoint(progress.current, length, preview ? -0.08 * id : lane),
        );
        group.current.rotation.y = -((progress.current / length) * Math.PI * 2 + Math.PI);
      }
    }
  });
  const color = HORSE_COLORS[id];
  return (
    <group
      ref={group}
      position={target}
      scale={horse?.used ? 0.61 : 0.68}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
    >
      <mesh castShadow receiveShadow position={[-0.1, -0.065, 0]} scale={[1.16, 1, 0.47]}>
        <cylinderGeometry args={[0.96, 1, 0.12, theme.faceted ? 24 : 48]} />
        <meshStandardMaterial color={theme.metal} metalness={0.78} roughness={0.25} />
      </mesh>
      <mesh receiveShadow position={[-0.1, 0.003, 0]} scale={[1.14, 1, 0.44]}>
        <cylinderGeometry args={[0.95, 0.96, 0.024, theme.faceted ? 24 : 48]} />
        <meshPhysicalMaterial
          color={theme.id === 'imperial-porcelain' ? theme.track : theme.frame}
          roughness={0.28}
          clearcoat={0.5}
        />
      </mesh>
      <HorseSculpture color={color} theme={theme} />
      <sprite position={[0, 1.98, 0]} scale={[0.48, 0.48, 0.48]}>
        <spriteMaterial
          map={numberTexture}
          transparent
          opacity={horse?.used ? 0.65 : 1}
          depthWrite={false}
        />
      </sprite>
      <mesh position={[-0.12, 0.021, 0.31]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.25, 0.25]} />
        <meshBasicMaterial map={numberTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
function EllipseTrim({ x, z, theme }: { x: number; z: number; theme: BoardThemeDesign }) {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Array.from({ length: 96 }, (_, n) => {
          const angle = (n / 96) * Math.PI * 2;
          return new Vector3(Math.cos(angle) * x, 0.037, Math.sin(angle) * z);
        }),
        true,
      ),
    [x, z],
  );
  return (
    <mesh>
      <tubeGeometry args={[curve, 128, 0.014, 6, true]} />
      <meshStandardMaterial color={theme.metal} metalness={0.68} roughness={0.33} />
    </mesh>
  );
}
function BetToken({
  color,
  value,
  level,
  theme,
}: {
  color: string;
  value: number | null;
  level: number;
  theme: BoardThemeDesign;
}) {
  // BetView has already redacted private chip values on the server.
  const face = useLabelTexture(value === null ? '?' : String(value), theme, true);
  return (
    <group position={[0.43, 0.063 + level * 0.045, 0]}>
      <mesh>
        <cylinderGeometry args={[0.24, 0.24, 0.04, 32]} />
        <meshPhysicalMaterial color={color} roughness={0.3} metalness={0.14} clearcoat={0.7} />
      </mesh>
      <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.32, 0.32]} />
        <meshBasicMaterial map={face} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
function CardBay({
  id,
  theme,
  onSelect,
  view,
}: {
  id: number;
  theme: BoardThemeDesign;
  onSelect: (id: number) => void;
  view: GameView | null;
}) {
  const horse = view?.horses.find((horse) => horse.id === id);
  const numberTexture = useLabelTexture(String(id + 1), theme, true);
  const cardTexture = useLabelTexture(horse?.used ? 'RT' : String(id + 1), theme, true);
  const bets = view?.bets.filter((bet) => bet.horseId === id) ?? [];
  return (
    <group
      position={[(id - 3) * 1.88, 0.038, 4.71]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
    >
      <RoundedBox args={[1.72, 0.026, 0.84]} radius={0.01}>
        <meshStandardMaterial color={theme.metal} metalness={0.65} roughness={0.38} />
      </RoundedBox>
      <RoundedBox args={[1.66, 0.028, 0.78]} radius={0.01} position={[0, 0.015, 0]}>
        <meshStandardMaterial
          color={theme.id === 'nocturne' ? '#41282a' : theme.field}
          roughness={0.9}
        />
      </RoundedBox>
      {horse && (
        <>
          <RoundedBox args={[0.63, 0.025, 0.61]} radius={0.01} position={[-0.29, 0.039, 0]}>
            <meshStandardMaterial color={horse.used ? theme.frame : theme.card} roughness={0.65} />
          </RoundedBox>
          <mesh position={[-0.29, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={horse.used ? [0.25, 0.25] : [0.36, 0.36]} />
            <meshBasicMaterial map={cardTexture} transparent depthWrite={false} />
          </mesh>
          {horse.used &&
            [-1, 1].map((side) => (
              <mesh key={side} position={[-0.29 + side * 0.23, 0.056, 0]}>
                <boxGeometry args={[0.011, 0.005, 0.47]} />
                <meshStandardMaterial color={theme.metal} metalness={0.45} roughness={0.4} />
              </mesh>
            ))}
        </>
      )}
      <mesh position={[-0.69, 0.034, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, 0.22]} />
        <meshBasicMaterial map={numberTexture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0.43, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.265, 32]} />
        <meshStandardMaterial color={theme.metal} metalness={0.6} roughness={0.33} />
      </mesh>
      {bets.map((bet, level) => (
        <BetToken
          key={bet.seatId}
          color={
            HORSE_COLORS[view!.seats.findIndex((seat) => seat.id === bet.seatId)] ?? theme.metal
          }
          value={bet.value}
          level={level}
          theme={theme}
        />
      ))}
    </group>
  );
}
function Podium({ rank, x, theme }: { rank: number; x: number; theme: BoardThemeDesign }) {
  const height = rank === 1 ? 0.27 : rank === 2 ? 0.18 : 0.12;
  const numberTexture = useLabelTexture(['', 'I', 'II', 'III'][rank], theme, true);
  return (
    <group position={[x, 0.02, -0.5]}>
      <mesh position={[0, height / 2, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.71, 0.75, height, 48]} />
        <meshStandardMaterial color={theme.frame} metalness={0.15} roughness={0.36} />
      </mesh>
      <mesh position={[0, height + 0.01, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.71, 0.71, 0.035, 48]} />
        <meshStandardMaterial color={theme.metal} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, height + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.65, 0.65]} />
        <meshBasicMaterial map={numberTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
function Felt({
  length,
  actual,
  theme,
  onSelect,
  view,
}: {
  length: number;
  actual: boolean;
  theme: BoardThemeDesign;
  onSelect: (id: number) => void;
  view: GameView | null;
}) {
  const frameTexture = useSurfaceTexture(theme, true);
  const fieldTexture = useSurfaceTexture(theme);
  const ring = useMemo(() => {
    const shape = new Shape();
    shape.absellipse(0, 0, 6.65, 4.15, 0, Math.PI * 2, false, 0);
    const hole = new Shape();
    hole.absellipse(0, 0, 5.36, 2.95, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    return shape;
  }, []);
  return (
    <>
      <RoundedBox
        args={[16, 0.6, 11.4]}
        radius={theme.faceted ? 0.1 : 0.24}
        position={[0, -0.4, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          map={frameTexture}
          roughness={theme.id === 'royal-club' ? 0.35 : 0.22}
          clearcoat={0.5}
        />
      </RoundedBox>
      <RoundedBox args={[15.78, 0.04, 11.18]} radius={0.015} position={[0, -0.073, 0]}>
        <meshStandardMaterial color={theme.metal} roughness={0.3} metalness={0.72} />
      </RoundedBox>
      <RoundedBox
        args={[15.62, 0.095, 11.02]}
        radius={0.035}
        position={[0, -0.025, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          map={fieldTexture}
          roughness={theme.id === 'imperial-porcelain' ? 0.24 : 0.9}
          clearcoat={theme.id === 'imperial-porcelain' ? 0.7 : 0.05}
        />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <shapeGeometry args={[ring, 128]} />
        <meshStandardMaterial
          color={theme.track}
          roughness={theme.id === 'imperial-porcelain' ? 0.32 : 0.72}
        />
      </mesh>
      <EllipseTrim x={6.65} z={4.15} theme={theme} />
      <EllipseTrim x={5.36} z={2.95} theme={theme} />
      <EllipseTrim x={6.74} z={4.24} theme={theme} />
      {actual &&
        Array.from({ length }, (_, n) => {
          const p = trackPoint(n - 0.5, length);
          const label = trackPoint(n, length, 0.42);
          return (
            <group key={n}>
              <mesh
                position={[p.x, 0.034, p.z]}
                rotation={[0, ((-n + 0.5) / length) * Math.PI * 2, 0]}
              >
                <boxGeometry args={[0.018, 0.006, 1.15]} />
                <meshStandardMaterial color={theme.trackLine} roughness={0.6} />
              </mesh>
              <group position={[label.x, 0.04, label.z]}>
                <TrackLabel value={n} theme={theme} />
              </group>
            </group>
          );
        })}
      {Array.from({ length: 16 }, (_, n) => (
        <mesh key={n} position={[((n % 2) - 0.5) * 0.115, 0.044, 3.04 + Math.floor(n / 2) * 0.145]}>
          <boxGeometry args={[0.115, 0.012, 0.145]} />
          <meshStandardMaterial
            color={((n % 2) + Math.floor(n / 2)) % 2 ? theme.label : theme.track}
          />
        </mesh>
      ))}
      <FeltMark theme={theme} />
      {[2, 1, 3].map((rank, i) => (
        <Podium key={rank} rank={rank} x={(i - 1) * 1.7} theme={theme} />
      ))}
      {HORSE_COLORS.map((_, id) => (
        <CardBay key={id} id={id} theme={theme} onSelect={onSelect} view={view} />
      ))}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group
            key={`${x}-${z}`}
            position={[x * 7.1, 0.035, z * 4.86]}
            rotation={[0, (x * z * Math.PI) / 4, 0]}
          >
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[(i - 1) * 0.085, 0, 0]}>
                <boxGeometry args={[0.021, 0.017, 0.57 - Math.abs(i - 1) * 0.13]} />
                <meshStandardMaterial color={theme.metal} roughness={0.32} metalness={0.7} />
              </mesh>
            ))}
          </group>
        )),
      )}
    </>
  );
}
function FlatTable({
  view,
  language,
  onSelect,
}: {
  view: GameView | null;
  language: Language;
  onSelect: (id: number) => void;
}) {
  const t = strings(language);
  return (
    <div className="flat-table" aria-label={t.flat}>
      <div className="flat-ring" />
      <div className="flat-brand">
        <span>ROYAL</span>
        <strong>TURF</strong>
        <small>RACING CLUB</small>
      </div>
      {HORSE_COLORS.map((color, id) => {
        const h = view?.horses.find((h) => h.id === id);
        const stack =
          view?.horses
            .filter((x) => x.position === h?.position && x.rank === null)
            .sort((a, b) => a.id - b.id) ?? [];
        const offset =
          stack.length > 1
            ? (stack.findIndex((x) => x.id === id) - (stack.length - 1) / 2) * 0.11
            : 0;
        const angle =
          ((h?.position ?? -id * 1.15) / (view?.rules?.trackLength ?? 36)) * Math.PI * 2 +
          Math.PI / 2 +
          offset;
        const left = h?.rank
          ? h.rank === 1
            ? 50
            : h.rank === 2
              ? 36
              : 64
          : 50 + Math.cos(angle) * 39;
        const top = h?.rank ? 55 : 50 + Math.sin(angle) * 36;
        return (
          <button
            key={id}
            className="flat-horse"
            onClick={() => onSelect(id)}
            style={{ background: color, left: `${left}%`, top: `${top}%` }}
            aria-label={`${id + 1} ${h?.names[language] ?? ''}`}
          >
            <span>♞</span>
            <b>{id + 1}</b>
          </button>
        );
      })}
    </div>
  );
}
export function Tabletop({
  view,
  language,
  onSelect,
  boardTheme,
}: {
  view: GameView | null;
  language: Language;
  onSelect: (id: number) => void;
  boardTheme?: BoardTheme;
}) {
  const theme = getBoardTheme(boardTheme ?? view?.boardTheme);
  const [flat, setFlat] = useState(() => !hasWebGL());
  const [overhead, setOverhead] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReduced(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  const t = strings(language),
    actual = !!view?.rules && view.horses.length > 0;
  const length = view?.rules?.trackLength ?? 36; // Preview geometry only; no unverified rule enters a game.
  const fallback = <FlatTable view={view} language={language} onSelect={onSelect} />;
  return (
    <section
      className="tabletop"
      data-board-theme={theme.id}
      style={themeVariables(theme) as CSSProperties}
      aria-label={actual ? t.table : t.preview}
    >
      <div className="board-caption">
        <span className="live-dot" />
        {actual
          ? `${view!.edition.demo ? t.demoLabel + ' · ' : ''}${t.round} ${view!.race} / ${view!.edition.raceCount ?? 3}`
          : t.preview}
        <span className="board-theme-caption"> · {theme.name[language]}</span>
      </div>
      {flat ? (
        fallback
      ) : (
        <CanvasGuard fallback={fallback}>
          <Suspense fallback={fallback}>
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{ position: [10, 12.5, 13], fov: 38 }}
              gl={{ antialias: true }}
              onCreated={({ gl }) => {
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                  event.preventDefault();
                  setFlat(true);
                });
              }}
            >
              <color attach="background" args={[theme.scene]} />
              <StudioReflections />
              <ambientLight intensity={0.85} />
              <hemisphereLight args={['#fff8ec', theme.field, 0.65]} />
              <directionalLight position={[-8, 7, -5]} intensity={1.1} color="#e7edff" />
              <directionalLight
                castShadow
                position={[4, 12, 8]}
                intensity={2.6}
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-12}
                shadow-camera-right={12}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
              />
              <Camera overhead={overhead} />
              <Felt length={length} actual={actual} theme={theme} onSelect={onSelect} view={view} />
              {HORSE_COLORS.map((_, id) => {
                const horse = view?.horses.find((h) => h.id === id);
                const stack =
                  view?.horses
                    .filter((h) => h.rank === null && h.position === horse?.position)
                    .sort((a, b) => a.id - b.id) ?? [];
                const lane =
                  stack.length > 1
                    ? (stack.findIndex((h) => h.id === id) - (stack.length - 1) / 2) * 0.2
                    : 0;
                return (
                  <Horse
                    key={id}
                    id={id}
                    horse={horse}
                    length={length}
                    onSelect={onSelect}
                    reduced={reduced}
                    preview={!actual}
                    lane={lane}
                    theme={theme}
                  />
                );
              })}
              <ContactShadows
                position={[0, -0.8, 0]}
                opacity={0.3}
                scale={25}
                blur={2}
                far={4}
                resolution={256}
                frames={1}
              />
            </Canvas>
          </Suspense>
        </CanvasGuard>
      )}
      <div className="camera-controls">
        {!flat && (
          <button onClick={() => setOverhead(!overhead)}>
            {overhead ? '◈' : '⊞'} {overhead ? t.angle : t.top}
          </button>
        )}
        <button onClick={() => setFlat(!flat)}>{flat ? t.three : t.flat}</button>
      </div>
    </section>
  );
}
