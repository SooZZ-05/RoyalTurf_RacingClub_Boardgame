import { useMemo } from 'react';
import { CatmullRomCurve3, Color, Quaternion, Shape, Vector3 } from 'three';
import type { BoardThemeDesign } from './themes';

type Point = [number, number, number];
const up = new Vector3(0, 1, 0);

function Limb({
  from,
  to,
  radius,
  color,
  theme,
}: {
  from: Point;
  to: Point;
  radius: number;
  color: string;
  theme: BoardThemeDesign;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new Vector3(...from),
      end = new Vector3(...to);
    const direction = end.clone().sub(start);
    return {
      position: start.add(end).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  return (
    <mesh castShadow position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius * 0.75, radius, length, theme.faceted ? 6 : 12]} />
      <meshPhysicalMaterial
        color={color}
        roughness={theme.bodyRoughness}
        metalness={theme.bodyMetalness}
        clearcoat={theme.faceted ? 0.25 : 0.8}
        flatShading={theme.faceted}
      />
    </mesh>
  );
}

function BodyPart({
  position,
  scale,
  rotation = 0,
  color,
  theme,
}: {
  position: Point;
  scale: Point;
  rotation?: number;
  color: string;
  theme: BoardThemeDesign;
}) {
  return (
    <mesh castShadow position={position} scale={scale} rotation={[0, 0, rotation]}>
      <sphereGeometry args={[1, theme.faceted ? 8 : 20, theme.faceted ? 6 : 16]} />
      <meshPhysicalMaterial
        color={color}
        roughness={theme.bodyRoughness}
        metalness={theme.bodyMetalness}
        clearcoat={theme.faceted ? 0.25 : 0.9}
        clearcoatRoughness={0.18}
        flatShading={theme.faceted}
      />
    </mesh>
  );
}

const legs: [Point, Point, Point, Point][] = [
  [
    [0.34, 0.71, -0.16],
    [0.17, 0.45, -0.18],
    [0.14, 0.22, -0.18],
    [0.06, 0.1, -0.18],
  ],
  [
    [-0.43, 0.68, -0.17],
    [-0.73, 0.41, -0.19],
    [-0.77, 0.27, -0.19],
    [-0.92, 0.1, -0.19],
  ],
  [
    [-0.4, 0.68, 0.18],
    [-0.21, 0.43, 0.21],
    [-0.44, 0.3, 0.21],
    [-0.55, 0.1, 0.21],
  ],
  [
    [0.38, 0.75, 0.18],
    [0.61, 0.48, 0.21],
    [0.72, 0.29, 0.21],
    [0.81, 0.1, 0.21],
  ],
];

/** A shared horse silhouette keeps the seven racing colours identifiable in every finish. */
export function HorseSculpture({ color, theme }: { color: string; theme: BoardThemeDesign }) {
  const maneColor = useMemo(
    () => `#${new Color(color).multiplyScalar(0.65).getHexString()}`,
    [color],
  );
  const mane = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0.57, 1.45);
    shape.bezierCurveTo(0.32, 1.38, 0.22, 1.01, -0.08, 0.9);
    shape.lineTo(-0.19, 0.96);
    shape.quadraticCurveTo(0.0, 0.99, 0.0, 1.12);
    shape.quadraticCurveTo(0.17, 1.07, 0.16, 1.24);
    shape.quadraticCurveTo(0.3, 1.21, 0.3, 1.35);
    shape.quadraticCurveTo(0.42, 1.32, 0.45, 1.46);
    shape.closePath();
    return shape;
  }, []);
  const tail = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.61, 0.83, 0),
        new Vector3(-0.87, 0.81, 0),
        new Vector3(-0.97, 0.58, 0),
        new Vector3(-1.11, 0.46, 0.04),
        new Vector3(-1.26, 0.51, 0.04),
      ]),
    [],
  );
  return (
    <group>
      {legs.map(([hip, knee, ankle, hoof], index) => (
        <group key={index}>
          <Limb from={hip} to={knee} radius={0.08} color={color} theme={theme} />
          <BodyPart position={knee} scale={[0.065, 0.07, 0.065]} color={color} theme={theme} />
          <Limb from={knee} to={ankle} radius={0.045} color={color} theme={theme} />
          <Limb from={ankle} to={hoof} radius={0.033} color={color} theme={theme} />
          <mesh
            castShadow
            position={[hoof[0] + 0.025, hoof[1] - 0.035, hoof[2]]}
            rotation={[0, 0, -0.12]}
          >
            <cylinderGeometry args={[0.057, 0.07, 0.09, theme.faceted ? 6 : 12]} />
            <meshStandardMaterial color={theme.metal} metalness={0.7} roughness={0.27} />
          </mesh>
        </group>
      ))}
      <BodyPart
        position={[-0.1, 0.79, 0]}
        scale={[0.59, 0.245, 0.215]}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[-0.47, 0.8, 0]}
        scale={[0.27, 0.29, 0.235]}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[0.31, 0.8, 0]}
        scale={[0.23, 0.29, 0.225]}
        rotation={-0.18}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[0.37, 1.02, 0]}
        scale={[0.18, 0.36, 0.17]}
        rotation={-0.4}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[0.52, 1.25, 0]}
        scale={[0.13, 0.24, 0.125]}
        rotation={-0.3}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[0.67, 1.37, 0]}
        scale={[0.23, 0.125, 0.122]}
        rotation={-0.45}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[0.81, 1.25, 0]}
        scale={[0.22, 0.09, 0.095]}
        rotation={-0.68}
        color={color}
        theme={theme}
      />
      <BodyPart
        position={[0.91, 1.14, 0]}
        scale={[0.105, 0.083, 0.1]}
        rotation={-0.45}
        color={color}
        theme={theme}
      />
      {[-0.072, 0.072].map((z) => (
        <group key={z}>
          <mesh
            castShadow
            position={[0.55, 1.55, z]}
            rotation={[0, 0, -0.29]}
            scale={[0.75, 1, 0.52]}
          >
            <coneGeometry args={[0.065, 0.25, theme.faceted ? 5 : 12]} />
            <meshPhysicalMaterial color={color} roughness={theme.bodyRoughness} clearcoat={0.8} />
          </mesh>
          <mesh position={[0.71, 1.39, z * 1.56]}>
            <sphereGeometry args={[0.021, 10, 8]} />
            <meshStandardMaterial color="#101419" roughness={0.12} />
          </mesh>
          <mesh position={[0.925, 1.17, z * 1.2]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshStandardMaterial color={maneColor} />
          </mesh>
          <Limb
            from={[0.59, 1.46, z * 1.75]}
            to={[0.91, 1.17, z * 1.3]}
            radius={0.012}
            color={theme.metal}
            theme={theme}
          />
          <Limb
            from={[0.71, 1.29, z * 1.8]}
            to={[0.27, 0.94, z * 2.8]}
            radius={0.009}
            color={theme.metal}
            theme={theme}
          />
        </group>
      ))}
      <Limb
        from={[0.89, 1.2, -0.098]}
        to={[0.89, 1.2, 0.098]}
        radius={0.013}
        color={theme.metal}
        theme={theme}
      />
      <mesh castShadow position={[0, 0, -0.037]}>
        <extrudeGeometry
          args={[
            mane,
            {
              depth: 0.074,
              bevelEnabled: true,
              bevelSegments: theme.faceted ? 1 : 3,
              steps: 1,
              bevelSize: 0.018,
              bevelThickness: 0.018,
            },
          ]}
        />
        <meshPhysicalMaterial
          color={maneColor}
          roughness={theme.bodyRoughness + 0.12}
          clearcoat={0.55}
          flatShading={theme.faceted}
        />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[tail, 16, 0.065, theme.faceted ? 5 : 10, false]} />
        <meshPhysicalMaterial
          color={maneColor}
          roughness={theme.bodyRoughness + 0.12}
          clearcoat={0.55}
          flatShading={theme.faceted}
        />
      </mesh>
    </group>
  );
}
