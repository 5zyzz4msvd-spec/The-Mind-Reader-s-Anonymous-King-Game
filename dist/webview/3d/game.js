import * as THREE from './vendor/three.module.min.js';

const DEMO_CANARY = 'king-game:pseudo3d:0.6.5';
const EMBEDDED = window.__KING_GAME_3D_EMBEDDED__ === true || new URLSearchParams(location.search).get('embedded') === '1';
const root = document.querySelector('#kg-game');
root.dataset.runtimeCanary = DEMO_CANARY;
root.dataset.embedded = EMBEDDED ? 'true' : 'false';
let hostSnapshot = null;
let hostOverlayBlocked = false;
let hostActive = true;
let tableFocus = false;
let tableFocusMix = 0;

function postHostIntent(action, extra = {}) {
  if (!EMBEDDED || window.parent === window) return false;
  window.parent.postMessage({ type: 'king-game-3d:intent', action, ...extra }, '*');
  return true;
}


const viewport = document.querySelector('#viewport');
const miniMap = document.querySelector('#miniMap');
const mapContext = miniMap.getContext('2d');
const loadingState = document.querySelector('#loadingState');
const zoneLabel = document.querySelector('#zoneLabel');
const locationTag = document.querySelector('#locationTag');
const partyList = document.querySelector('#partyList');
const dialogLayer = document.querySelector('#dialogLayer');
const dialogKicker = document.querySelector('#dialogKicker');
const dialogTitle = document.querySelector('#dialogTitle');
const dialogBody = document.querySelector('#dialogBody');
const dialogPrimary = document.querySelector('#dialogPrimary');
const leftDrawer = document.querySelector('#leftDrawer');
const leftDrawerTitle = document.querySelector('#leftDrawerTitle');
const leftDrawerBody = document.querySelector('#leftDrawerBody');
const drawerScrim = document.querySelector('#drawerScrim');
const toast = document.querySelector('#toast');

const TILE = 0.8;
const EYE_HEIGHT = 1.65;
const WALL_HEIGHT = 2.8;
const HALL_SIZE = 18 * TILE;
const HALL_RADIUS = HALL_SIZE / 2;
const ROOM_SIZE = 7 * TILE;
const ROOM_CENTER = HALL_RADIUS + ROOM_SIZE / 2 + .32;
const roomNames = ['穆裳希','林安','许知夏','你的房间','王可可','张曲溪'];
const roomColors = [0x7e454c,0x876a43,0x376f6c,0x66657e,0x486688,0x5f7047];
const doors = [];
let connected = false, activeRoom = -1, lastHostPlace = null;
const TABLE_RADIUS = 2;
const CEILING_LIGHT_HEIGHT = WALL_HEIGHT - 0.055;
const INTERACTION_RANGE = 1.85;
let moveSpeed = 3.6;
let lookSpeed = THREE.MathUtils.degToRad(160);
let showHands = false;
let invertLook = false;
const MAX_PITCH = Math.PI / 3;

const characterSpecs = [
  { id: 'lin', name: '林安', height: 169, image: './assets/runtime/standees/lin-an-painterly-v1.webp', fallbackImage: './assets/runtime/lin-an-anime-v8.png', color: '#65c7b7', position: [-2.75, -1.35], note: '她扶着棕色侦探帽的帽檐，露出轻快的笑。' },
  { id: 'mu', name: '穆裳希', height: 172, image: './assets/runtime/standees/mu-shangxi-painterly-v1.webp', fallbackImage: './assets/runtime/mu-shangxi-anime-v2.png', color: '#8da6e8', position: [2.7, -1.25], note: '她束着白色长发，一手托肘，另一手停在耳环下方。' },
  { id: 'zhang', name: '张曲溪', height: 175, image: './assets/runtime/standees/zhang-quxi-painterly-v1.webp', fallbackImage: './assets/runtime/zhang-quxi-anime-v2.png', color: '#e17897', position: [-2.7, 1.75], note: '她微微侧身站着，一手托着另一侧前臂，目光朝前。' },
  { id: 'wang', name: '王可可', height: 168, image: './assets/runtime/standees/wang-keke-painterly-v1.webp', fallbackImage: './assets/runtime/wang-keke-anime-v4.png', color: '#c697ed', position: [2.65, 1.8], note: '她的指尖轻搭在衬衫领口，脸上带着克制的微笑。' },
  { id: 'zhixia', name: '许知夏', role: '住校大学生', height: 162, image: './assets/runtime/standees/xu-zhixia-painterly-v1.webp', fallbackImage: './assets/runtime/xu-zhixia-anime-v1.png', color: '#f0b36a', position: [0, -3.15], note: '十九岁的住校大学生许知夏穿灰青Polo衫与深蓝短裤；陌生密室里，她信赖此前认真为自己推荐饭店的玩家。' },
];

const stageGallery = [
  ['韩璇 · 稻草人档案', './assets/stage/runtime/han-xuan-scarecrow-anime-v1.webp', false],
  ['姐妹生日照', './assets/stage/runtime/wang-sister-anime-v1.webp', true],
  ['苏晚晴 · 旧书店', './assets/stage/runtime/zhang-su-wanqing-anime-v1.webp', true],
  ['韩璇 · 雨夜', './assets/stage/runtime/zhang-han-xuan-anime-v1.webp', true],
  ['罗云枝 · 美术馆', './assets/stage/runtime/zhang-luo-yunzhi-anime-v1.webp', true],
  ['秦烈 · 漫展', './assets/stage/runtime/zhang-qin-lie-anime-v1.webp', true],
  ['黎夏妍 · 游戏厅', './assets/stage/runtime/zhang-li-xiayan-anime-v1.webp', true],
];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.setClearColor(0x08090b, 1);
viewport.prepend(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  if (EMBEDDED) postHostIntent('3d-error');
  else loadingState.textContent = '3D 渲染暂不可用，请刷新页面重试。';
});

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x111216, 8, 22);
const camera = new THREE.PerspectiveCamera(66, 16 / 9, 0.05, 60);
camera.rotation.order = 'YXZ';

const state = {
  zone: 'hall',
  position: new THREE.Vector3(0, EYE_HEIGHT, 4.65),
  targetPosition: new THREE.Vector3(0, EYE_HEIGHT, 4.65),
  yaw: 0,
  targetYaw: 0,
  pitch: 0,
  targetPitch: 0,
  mapVisible: true,
  rulerVisible: false,
  dialogAction: null,
  decreeMode: 'issue',
  moving: false,
};

const world = new THREE.Group();
scene.add(world);
const billboards = [];
const interactives = [];
let rulerGroup = null;
let toastTimer = null;
const pressedKeys = new Set();
const joystickInput = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };
const joystickResets = [];
const movementKeys = new Set(['w','a','s','d','q','e','arrowup','arrowdown','shift']);

function clearSceneInput() {
  pressedKeys.clear();
  joystickResets.forEach(reset => reset());
}

function applyScenePreferences(p) {
  if (!p || typeof p !== 'object') return;
  if (Number.isFinite(p.moveSpeed)) moveSpeed = THREE.MathUtils.clamp(p.moveSpeed,.8,6);
  if (Number.isFinite(p.turnSpeed)) lookSpeed = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(p.turnSpeed,45,260));
  root.dataset.hintsHidden = String(p.hideHints === true);
  root.dataset.joysticksHidden = String(p.hideJoysticks === true);
  if (p.hideJoysticks) joystickResets.forEach(reset => reset());
  showHands = p.showHands === true;
  invertLook = p.invertLook === true;
  state.mapVisible = p.hideMap !== true;
  miniMap.classList.toggle('is-hidden', !state.mapVisible);
}

function setTableFocus(active) {
  if (active && !tableFocus && tableFocusMix === 0) {
    state.targetPosition.copy(state.position);
    state.targetYaw = state.yaw;
    state.targetPitch = state.pitch;
    if (activeRoom >= 0 && doors[activeRoom]) doors[activeRoom].userData.open = true;
  }
  tableFocus = active;
  root.dataset.tableFocus = String(active);
}

function startManualControl() {
  if (sceneInputBlocked()) return false;
  if (tableFocus) {
    setTableFocus(false);
    postHostIntent('cancel-table-focus');
  }
  return true;
}

function setControlKey(key, down) {
  if (!movementKeys.has(key)) return false;
  if (!down) return pressedKeys.delete(key);
  if (!startManualControl()) return false;
  pressedKeys.add(key);
  return true;
}

function registerInteractive(object) {
  interactives.push(object);
  return object;
}

const textureLoader = new THREE.TextureLoader();

function configureTexture(texture, repeatX = 1, repeatY = 1) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

// Seeded, tileable grains: the room can be built without environment images.
function surfaceTexture(seed, rgb, grain, directional = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const stripe = (seed / 4294967296 - .5) * (directional ? grain * .75 : 0);
    for (let x = 0; x < 256; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const v = stripe + (seed / 4294967296 - .5) * grain
        + Math.sin(x * Math.PI / 32) * Math.cos(y * Math.PI / 64) * 1.5;
      const i = (y * 256 + x) * 4;
      for (let c = 0; c < 3; c++) pixels.data[i + c] = rgb[c] + v;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
const wallTexture = surfaceTexture(21, [204, 199, 188], 17);
const floorTexture = surfaceTexture(34, [61, 62, 63], 12);
const tableTexture = surfaceTexture(55, [87, 82, 74], 12, true);
const metalTexture = surfaceTexture(89, [158, 166, 170], 13, true);
configureTexture(metalTexture, 1, 4);

configureTexture(wallTexture, 5, 2);
configureTexture(floorTexture, 7, 7);
configureTexture(tableTexture, 1, 1);

const materials = {
  wall: new THREE.MeshStandardMaterial({ map: wallTexture, bumpMap: wallTexture, bumpScale: 0.012, color: 0xe6dfcf, roughness: 0.92 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTexture, bumpMap: floorTexture, bumpScale: 0.008, roughness: 0.84 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 1, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.68, metalness: 0.22 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x9a7839, roughness: 0.48, metalness: 0.56 }),
  tableTop: new THREE.MeshStandardMaterial({ map: tableTexture, roughness: 0.74, metalness: 0.035 }),
  tableSide: new THREE.MeshStandardMaterial({ color: 0x191a1d, roughness: 0.48, metalness: 0.28 }),
  chairFrame: new THREE.MeshStandardMaterial({ color: 0xb88a4c, roughness: 0.48, metalness: 0.42 }),
  chairSeat: new THREE.MeshStandardMaterial({ color: 0x9f493d, roughness: 0.82, metalness: 0.02 }),
  doorFrame: new THREE.MeshStandardMaterial({ map: metalTexture, color: 0x8998a1, roughness: 0.4, metalness: 0.42 }),
  doorPanel: new THREE.MeshStandardMaterial({ color: 0x3e505b, roughness: 0.66, metalness: 0.28 }),
  doorInset: new THREE.MeshStandardMaterial({ color: 0x526772, roughness: 0.72, metalness: 0.18 }),
  hatchSeam: new THREE.MeshStandardMaterial({ color: 0x34383a, roughness: 0.9, metalness: 0.12 }),
  ceilingLight: new THREE.MeshBasicMaterial({ color: 0xe4ebec }),
  ceilingLightRim: new THREE.MeshStandardMaterial({ color: 0x899397, roughness: 0.44, metalness: 0.32 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0xe4e8e5, roughness: 0.26 }),
  toiletSeat: new THREE.MeshStandardMaterial({ color: 0xcbd3cf, roughness: 0.42 }),
  bowlWater: new THREE.MeshStandardMaterial({ color: 0x7f999d, roughness: 0.17, metalness: 0.06 }),
  bedding: new THREE.MeshStandardMaterial({ color: 0xd1cdc1, roughness: 0.98 }),
  bedCover: new THREE.MeshStandardMaterial({ color: 0x626e73, roughness: 0.94 }),
};
const curvedWallMaterial = materials.wall.clone();
curvedWallMaterial.side = THREE.BackSide;
const curvedTrimMaterial = materials.tableSide.clone();
curvedTrimMaterial.side = THREE.BackSide;

scene.add(new THREE.HemisphereLight(0xdce9f4, 0x575e66, 1.03));
const ceilingLight = new THREE.PointLight(0xf4f6ff, 9, 14, 2);
ceilingLight.position.set(0, CEILING_LIGHT_HEIGHT, 0);
scene.add(ceilingLight);
const tableLight = new THREE.SpotLight(0xffe9cc, 13, 9, 0.93, 0.82, 2);
tableLight.position.set(0, CEILING_LIGHT_HEIGHT - 0.025, 0);
scene.add(tableLight, tableLight.target);

function addBox({ size, position, material = materials.wall, rotation = [0, 0, 0], parent = world, data = null }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (data) {
    mesh.userData = data;
    registerInteractive(mesh);
  }
  parent.add(mesh);
  return mesh;
}

function addFloor(size, parent = world, circular = false) {
  const geometry = () => circular ? new THREE.CircleGeometry(size / 2, 120) : new THREE.PlaneGeometry(size, size);
  const floor = new THREE.Mesh(geometry(), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  parent.add(floor);
  const ceiling = new THREE.Mesh(geometry(), materials.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  ceiling.userData.overheadOccluder = true;
  parent.add(ceiling);
  const lightRadius = size > ROOM_SIZE ? 1.08 : 0.68;
  const lightRim = new THREE.Mesh(new THREE.RingGeometry(lightRadius, lightRadius + 0.055, 64), materials.ceilingLightRim);
  lightRim.rotation.x = Math.PI / 2;
  lightRim.position.y = CEILING_LIGHT_HEIGHT - 0.004;
  lightRim.userData.overheadOccluder = true;
  parent.add(lightRim);
  const lightPanel = new THREE.Mesh(new THREE.CircleGeometry(lightRadius, 64), materials.ceilingLight);
  lightPanel.rotation.x = Math.PI / 2;
  lightPanel.position.y = CEILING_LIGHT_HEIGHT - 0.006;
  lightPanel.userData.overheadOccluder = true;
  parent.add(lightPanel);
}

function addCircularHallShell(parent = world) {
  addFloor(HALL_SIZE, parent, true);
  const gap = Math.asin(.63 / HALL_RADIUS);
  const names = ['穆裳希', '林安', '许知夏', '你的房间', '王可可', '张曲溪'];
  const step = Math.PI / 3;
  for (let i = 0; i < names.length; i++) {
    const yaw = i * step;
    const slot = new THREE.Group();
    slot.rotation.y = yaw;
    parent.add(slot);
    const openingZ = -Math.sqrt(HALL_RADIUS ** 2 - .63 ** 2);
    const doorZ = openingZ - .23;
    // Continue the curved wall above the rectangular opening, not a
    // protruding straight lintel in front of the wall face.
    const header = new THREE.Mesh(new THREE.CylinderGeometry(HALL_RADIUS,HALL_RADIUS,WALL_HEIGHT-2.22,16,1,true,yaw-gap+Math.PI,gap*2), curvedWallMaterial);
    header.position.y = (WALL_HEIGHT+2.22)/2;
    parent.add(header);
    addBox({ size: [1.28,.026,.31], position: [0,.013,doorZ + .10], material: materials.tableSide, parent: slot });
    for (const x of [-.645,.645]) {
      addBox({ size: [.07, 2.22, .36], position: [x, 1.11, doorZ + .10], material: materials.doorFrame, parent: slot });
    }
    const door = addDoor(names[i], Math.sin(yaw) * doorZ, Math.cos(yaw) * doorZ, yaw, 'room', parent);
    door.userData.roomIndex = i;
    door.userData.hinge.traverse(mesh => {
      if (mesh.userData.kind === 'door') {
        mesh.userData.doorIndex=i;
        mesh.material=materials.doorPanel.clone();
        mesh.material.color.setHex(roomColors[i]);
      } else if(mesh.material===materials.doorInset) {
        mesh.material=materials.doorInset.clone();
        mesh.material.color.setHex(roomColors[i]).multiplyScalar(1.16);
      }
    });
    if (parent === world) doors[i] = door;
    const start = yaw + gap, sweep = step - gap * 2;
    const arc = (radius, height, material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,28,1,true,start + Math.PI,sweep), material);
      mesh.position.y = height / 2;
      parent.add(mesh);
    };
    arc(HALL_RADIUS,WALL_HEIGHT,curvedWallMaterial);
    arc(HALL_RADIUS - .025,.085,curvedTrimMaterial);
    const cap = new THREE.Mesh(new THREE.RingGeometry(HALL_RADIUS,HALL_RADIUS + .16,28,1,start + Math.PI / 2,sweep), materials.wall);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = WALL_HEIGHT;
    parent.add(cap);
  }
}

function addWallRun(length, x, z, yaw, openings = [], parent = world) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  parent.add(group);
  const span = (left, right, bottom, height, trim) => {
    if (right - left < .01) return;
    const center = (left + right) / 2;
    addBox({ size: [right - left, height, .19], position: [center, bottom + height / 2, 0], parent: group });
    if (trim) {
      addBox({ size: [right - left, .082, .026], position: [center, .042, .103], material: materials.tableSide, parent: group });
      addBox({ size: [right - left, .012, .018], position: [center, .089, .102], material: materials.doorFrame, parent: group });
    }
  };
  let left = -length / 2;
  for (const center of openings) {
    span(left, center - .59, 0, WALL_HEIGHT, true);
    span(center - .59, center + .59, 2.22, WALL_HEIGHT - 2.22, false);
    left = center + .59;
  }
  span(left, length / 2, 0, WALL_HEIGHT, true);
}

function addBeveledBox(width, height, depth, bevel, material, parent, x, y, z) {
  const shape = new THREE.Shape();
  const a = width / 2 - bevel, b = height / 2 - bevel;
  shape.moveTo(-a,-b); shape.lineTo(a,-b); shape.lineTo(a,b); shape.lineTo(-a,b); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  geometry.translate(0, 0, -(depth - 2 * bevel) / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}

function labelTexture(text, accent = '#d7b564') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(12,13,15,.88)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = accent;
  context.lineWidth = 4;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = '#f2ead8';
  context.font = '600 42px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addDoor(name, x, z, yaw, action = 'room', parent = world) {
  const group = new THREE.Group();
  group.userData.portalDoor = name;
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  parent.add(group);
  const hinge = new THREE.Group(), moving = new THREE.Group();
  hinge.position.x = -.55;
  moving.position.x = .55;
  hinge.add(moving);
  group.add(hinge);
  group.userData.open = false;
  group.userData.hinge = hinge;
  const leaf = addBeveledBox(1.10, 2.171, .09, .010, materials.doorPanel, moving, 0, 1.094, -.03);
  leaf.userData = { kind: 'door', title: name, action };
  if (parent === world) registerInteractive(leaf);
  addBeveledBox(.82, 1.35, .034, .009, materials.doorInset, moving, 0, .93, .026);
  addBox({ size: [0.1, 2.28, 0.18], position: [-0.59, 1.14, 0], material: materials.doorFrame, parent: group });
  addBox({ size: [0.1, 2.28, 0.18], position: [0.59, 1.14, 0], material: materials.doorFrame, parent: group });
  addBox({ size: [1.28, 0.1, 0.18], position: [0, 2.23, 0], material: materials.doorFrame, parent: group });
  // Thin stops behind the beveled edges prevent bright slivers when shut.
  for (const x of [-.541,.541]) {
    addBox({ size:[.038,2.16,.028], position:[x,1.085,-.093], material:materials.hatchSeam,parent:group });
  }
  addBox({ size:[1.105,.032,.028], position:[0,2.175,-.093], material:materials.hatchSeam,parent:group });
  addBox({ size:[1.11,.012,.16], position:[0,.006,-.02], material:materials.tableSide,parent:group });
  addBeveledBox(.105,.224,.034,.009,materials.trim,moving,.39,1.03,.035);
  for (const y of [.42,1.68]) {
    addBeveledBox(.08,.13,.045,.009,materials.doorFrame,group,-.51,y,.018);
  }
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(.017,.017,.066,16), materials.trim);
  spindle.rotation.x = Math.PI / 2;
  spindle.position.set(.39,1.03,.072);
  moving.add(spindle);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 16), materials.trim);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.345, 1.03, 0.103);
  moving.add(handle);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.2), new THREE.MeshBasicMaterial({ map: labelTexture(name), transparent: true }));
  label.position.set(0, 1.73, 0.075);
  moving.add(label);
  return group;
}

function addClosedSupplyHatch(x, y, z, parent = world) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  const panel = addBox({
    size: [0.7, 0.58, 0.018],
    position: [0, 0, 0],
    material: materials.wall,
    parent: group,
    data: { kind: 'hatch', title: '关闭的食物供给窗', body: '窗口与墙面齐平并保持关闭，只能看见一圈细窄矩形接缝。每日补给时才会开启。' },
  });
  panel.material = panel.material.clone();
  panel.material.color.multiplyScalar(0.93);
  addBox({ size: [0.74, 0.022, 0.028], position: [0, 0.3, 0.012], material: materials.hatchSeam, parent: group });
  addBox({ size: [0.74, 0.022, 0.028], position: [0, -0.3, 0.012], material: materials.hatchSeam, parent: group });
  addBox({ size: [0.022, 0.62, 0.028], position: [-0.37, 0, 0.012], material: materials.hatchSeam, parent: group });
  addBox({ size: [0.022, 0.62, 0.028], position: [0.37, 0, 0.012], material: materials.hatchSeam, parent: group });
}

function addWallToilet(x, z, parent = world) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);
  const profile = (points, material, depthScale, centerZ) => {
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r,y]) => new THREE.Vector2(r,y)), 48), material);
    mesh.scale.z = depthScale;
    mesh.position.z = centerZ;
    group.add(mesh);
    return mesh;
  };
  const bowl = profile([
    [0,.012],[.148,.012],[.163,.027],[.147,.094],[.133,.144],
    [.165,.197],[.204,.252],[.226,.322],[.229,.37],[.217,.39],
    [.189,.389],[.174,.363],[.153,.307],[.112,.246],[.056,.219],[0,.217]
  ], materials.porcelain, 1.24, .057);
  bowl.userData = { kind: 'prop', title: '靠墙马桶', body: '房间不设厕所隔墙，只有一只马桶直接靠墙安装。' };
  registerInteractive(bowl);
  profile([[.179,.392],[.213,.392],[.224,.399],[.221,.412],[.205,.42],[.184,.418],[.175,.409],[.179,.392]],
    materials.toiletSeat, 1.24, .057);
  const water = new THREE.Mesh(new THREE.CircleGeometry(.107, 32), materials.bowlWater);
  water.rotation.x = -Math.PI / 2;
  water.scale.y = 1.24;
  water.position.set(0, .241, .057);
  group.add(water);
  addBeveledBox(.27,.223,.168,.024,materials.porcelain,group,0,.331,-.211);
  addBeveledBox(.405,.335,.19,.036,materials.porcelain,group,0,.592,-.244);
  addBeveledBox(.423,.034,.204,.012,materials.porcelain,group,0,.77,-.244);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(.021,.021,.008,24), materials.doorFrame);
  button.position.set(.055,.791,-.244);
  group.add(button);
}

function addRoundTable(parent = world, interactive = true) {
  const tableGroup = new THREE.Group();
  tableGroup.userData = { kind: 'table', title: '六人圆桌', action: null };
  const topGeometry = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.1, 64);
  const top = new THREE.Mesh(topGeometry, [materials.tableSide, materials.tableTop, materials.tableSide]);
  top.position.y = 0.76;
  top.userData = tableGroup.userData;
  if (interactive) registerInteractive(top);
  tableGroup.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_RADIUS - 0.022, 0.014, 8, 80), materials.trim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.805;
  tableGroup.add(rim);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 0.7, 32), materials.tableSide);
  pedestal.position.y = 0.35;
  tableGroup.add(pedestal);
  const edge = new THREE.Mesh(new THREE.LatheGeometry([
    [1.92,.693],[1.985,.705],[2,.728],[2,.79],[1.987,.809]
  ].map(([r,y]) => new THREE.Vector2(r,y)), 80), materials.tableSide);
  tableGroup.add(edge);
  parent.add(tableGroup);

  for (let index = 0; index < 6; index += 1) {
    const angle = -Math.PI / 2 - index * Math.PI / 3;
    const chair = new THREE.Group();
    chair.position.set(Math.cos(angle) * 2.72, 0, Math.sin(angle) * 2.72);
    chair.rotation.y = -angle + Math.PI / 2;
    const upholstery = materials.chairSeat.clone();
    upholstery.color.setHex(roomColors[index]);
    chair.userData.seatOwner=roomNames[index];
    addBeveledBox(.58,.07,.55,.024,upholstery,chair,0,.475,0);
    const tube = (points) => {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      chair.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .021, 8, false), materials.doorFrame));
    };
    for (const x of [-.239,.239]) {
      tube([[x,.025,-.255],[x,.39,-.221],[x,.433,-.18],[x,.433,.188],[x,.47,.231],[x,.93,.303]]);
      tube([[x,.025,.281],[x,.30,.244],[x,.45,.232]]);
    }
    addBeveledBox(.505,.29,.081,.031,upholstery,chair,0,.79,.275).rotation.x = -.13;
    parent.add(chair);
  }
}

async function loadCharacterTexture(mesh, spec) {
  let texture;
  try {
    texture = await textureLoader.loadAsync(spec.image);
  } catch (error) {
    console.warn('[KingGame] 立绘加载失败，尝试备用图', spec.image, error);
    try {
      texture = await textureLoader.loadAsync(spec.fallbackImage);
    } catch (fallbackError) {
      console.warn('[KingGame] 备用立绘加载失败', spec.fallbackImage, fallbackError);
      return;
    }
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const height = spec.height / 100;
  const aspect = texture.image.width / texture.image.height;
  mesh.material.map = texture;
  mesh.material.needsUpdate = true;
  mesh.scale.set(height * aspect, height, 1);
  mesh.position.y = height / 2;
  mesh.visible = true;
}

function addCharacter(spec, x, z, characterIndex) {
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, depthWrite: true, depthTest: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.visible = false;
  mesh.position.x = x;
  mesh.position.z = z;
  mesh.userData = { kind: 'character', title: spec.name, body: spec.note, spec, characterIndex };
  registerInteractive(mesh);
  billboards.push(mesh);
  world.add(mesh);
  void loadCharacterTexture(mesh, spec);
  return mesh;
}

function addRuler(x, z) {
  rulerGroup = new THREE.Group();
  rulerGroup.position.set(x, 0, z);
  addBox({ size: [0.025, 2.05, 0.025], position: [0, 1.025, 0], material: materials.trim, parent: rulerGroup });
  [0.5, 1, 1.5, 1.6, 1.7, 1.8, 2].forEach(value => {
    addBox({ size: [value % 0.5 === 0 ? 0.22 : 0.14, 0.018, 0.02], position: [0.1, value, 0], material: materials.trim, parent: rulerGroup });
  });
  rulerGroup.visible = state.rulerVisible;
  world.add(rulerGroup);
}

function buildConnectedWorld() {
  if (connected) return;
  connected = true;
  addCircularHallShell();
  addRoundTable();
  for (let i=0;i<roomNames.length;i++) {
    const yaw = i*Math.PI/3, room = new THREE.Group();
    // addWallRun puts the room's opening on local +Z. Point that face
    // toward the hall centre, not outward into the unused exterior.
    room.rotation.y = yaw;
    room.position.set(-Math.sin(yaw)*ROOM_CENTER,0,-Math.cos(yaw)*ROOM_CENTER);
    world.add(room);
    addFloor(ROOM_SIZE,room);
    const half = ROOM_SIZE/2;
    addWallRun(ROOM_SIZE,0,-half,0,[],room);
    addWallRun(ROOM_SIZE,0,half,Math.PI,[0],room);
    addWallRun(ROOM_SIZE,-half,0,Math.PI/2,[],room);
    addWallRun(ROOM_SIZE,half,0,-Math.PI/2,[],room);
    addBeveledBox(1.95,.31,.95,.025,materials.tableSide,room,1.25,.165,-1.35);
    addBeveledBox(1.91,.16,.915,.046,materials.bedding,room,1.25,.424,-1.35);
    addBeveledBox(1.28,.033,.923,.013,materials.bedCover,room,.944,.501,-1.35);
    addBeveledBox(.38,.103,.61,.041,materials.bedding,room,1.955,.546,-1.35);
    addBeveledBox(.072,.665,.98,.023,materials.tableSide,room,2.245,.351,-1.35);
    addClosedSupplyHatch(1.2,1.18,-half+.086,room);
    addWallToilet(-1.72,-half+.44,room);
    const light = new THREE.PointLight(0xf4f6ff,9,7,2);
    light.position.y = CEILING_LIGHT_HEIGHT;
    room.add(light);
    const bridge = new THREE.Group();
    bridge.rotation.y = yaw;
    world.add(bridge);
    addBox({size:[1.25,.035,.45],position:[0,.004,-HALL_RADIUS-.16],material:materials.tableSide,parent:bridge});
  }
  characterSpecs.forEach((spec,i) => addCharacter(spec,...spec.position,i));
  addRuler(-5.1,-1.8);
}

function slotCoordinates(x,z,index) {
  const a = index*Math.PI/3;
  return [Math.cos(a)*x-Math.sin(a)*z,-Math.sin(a)*x-Math.cos(a)*z];
}
function slotPoint(index,x,r) {
  const a = index*Math.PI/3;
  return [Math.cos(a)*x-Math.sin(a)*r,-Math.sin(a)*x-Math.cos(a)*r];
}
function roomAt(x,z) {
  if (Math.hypot(x,z)<HALL_RADIUS) return -1;
  for (let i=0;i<roomNames.length;i++) {
    const [side,r] = slotCoordinates(x,z,i);
    if (Math.abs(side)<=ROOM_SIZE/2 && r>=HALL_RADIUS-.12 && r<=ROOM_CENTER+ROOM_SIZE/2) return i;
  }
  return -1;
}
function updateSpace() {
  const next=roomAt(state.position.x,state.position.z);
  if (next===activeRoom && state.zone===(next<0?'hall':'room')) return;
  activeRoom=next;
  state.zone=activeRoom<0?'hall':'room';
  zoneLabel.textContent=activeRoom<0?'中央大厅':roomNames[activeRoom];
  locationTag.textContent=activeRoom<0?'中央大厅 · 圆桌区':roomNames[activeRoom]+' · 个人房';
}
function setZone(zone,index=3) {
  buildConnectedWorld();
  const [x,z]=zone==='hall'?[0,4.65]:slotPoint(index,0,ROOM_CENTER-.85);
  state.position.set(x,EYE_HEIGHT,z);
  state.targetPosition.copy(state.position);
  state.yaw=state.targetYaw=zone==='hall'?0:index*Math.PI/3;
  state.pitch=state.targetPitch=0;
  updateSpace();
}
function roomForLocation(location, fallback=3) {
  if (/玩家|你的/.test(location)) return fallback;
  const i=roomNames.findIndex(name=>location.includes(name));
  return i<0?fallback:i;
}
function applyHostSnapshot(snapshot) {
  if (!EMBEDDED || !snapshot || typeof snapshot!=='object') return;
  hostSnapshot=snapshot;
  const system=snapshot.系统||{};
  const place=String(snapshot.玩家?.地点||system.当前地点||'');
  if (place && lastHostPlace!==place) {
    setZone(place.includes('大厅')?'hall':'room',roomForLocation(place));
    lastHostPlace=place;
  }
  billboards.forEach(mesh=>{
    const i=mesh.userData.characterIndex, spec=characterSpecs[i];
    const location=String(snapshot.角色?.[spec.name]?.地点||'');
    // Keep fixed seats in the hall and a separate five-person lineup in
    // every bedroom. The lineup stays clear of the bed, toilet and doorway.
    const room=roomForLocation(location,roomNames.indexOf(spec.name));
    const [x,z]=!location||location.includes('大厅')?spec.position:
      slotPoint(room,[-1.66,-.83,0,.83,1.66][i],ROOM_CENTER-.35);
    mesh.position.x=x; mesh.position.z=z;
  });
  root.querySelector('.scene-clock span').textContent='第 '+Number(system._当前天数||1)+' 日';
  root.querySelector('.scene-clock b').textContent=String(system.当前时间||'').replace(/^第\d+日\s*/,'')||'—';
  const daily=root.querySelector('[data-kg-action="daily"]');
  daily.hidden=system._每日阶段!=='待颁布法令'&&system._可过夜!==true;
  daily.querySelector('small').textContent=system._每日阶段==='待颁布法令'?'开始法令':'过夜';
  root.querySelector('[data-kg-action="open-decree"]').hidden=system._每日阶段!=='待颁布法令';
  window.parent.postMessage({type:'king-game-3d:menu-state', daily:!daily.hidden, decree:system._每日阶段==='待颁布法令'},'*');
}
function validPosition(x,z) {
  const radius=Math.hypot(x,z);
  if (radius<=HALL_RADIUS-.28) return radius>=TABLE_RADIUS+.48;
  for (let i=0;i<roomNames.length;i++) {
    const [side,r]=slotCoordinates(x,z,i);
    if (Math.abs(side)<=.42 && r>=HALL_RADIUS-.3 && r<=HALL_RADIUS+.68) {
      return r<HALL_RADIUS+.07 || doors[i]?.userData.hinge.rotation.y>1.12;
    }
    if (Math.abs(side)<=ROOM_SIZE/2-.28 && Math.abs(r-ROOM_CENTER)<=ROOM_SIZE/2-.28) return true;
  }
  return false;
}

function moveBy(dx, dz, notify = true) {
  const x = state.targetPosition.x + dx;
  const z = state.targetPosition.z + dz;
  if (!validPosition(x, z)) {
    if (notify) showToast(state.zone === 'hall' && Math.hypot(x, z) < TABLE_RADIUS + 0.48 ? '圆桌阻挡了前进路线' : '已经靠近墙面');
    return false;
  }
  state.targetPosition.x=x;
  state.targetPosition.z=z;
  return true;
}

function moveForward(direction) {
  moveBy(-Math.sin(state.targetYaw) * TILE * direction, -Math.cos(state.targetYaw) * TILE * direction);
}

function strafe(direction) {
  moveBy(Math.cos(state.targetYaw) * TILE * direction, -Math.sin(state.targetYaw) * TILE * direction);
}

function turn(direction) {
  state.targetYaw += direction * Math.PI / 2;
}

function sceneInputBlocked() {
  const active = document.activeElement;
  return hostOverlayBlocked || !hostActive || dialogLayer.getAttribute('aria-hidden') === 'false'
    || leftDrawer.getAttribute('aria-hidden') === 'false'
    || active?.matches?.('input,textarea,select,[contenteditable="true"]');
}

function applyContinuousControls(delta) {
  if (sceneInputBlocked()) return;
  let moveX = joystickInput.moveX + (pressedKeys.has('d') ? .58 : 0) - (pressedKeys.has('a') ? .58 : 0);
  let moveY = joystickInput.moveY + (pressedKeys.has('w') || pressedKeys.has('arrowup') ? .58 : 0) - (pressedKeys.has('s') || pressedKeys.has('arrowdown') ? .58 : 0);
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude; }
  if (magnitude > 0.01) {
    const distance = moveSpeed * delta * (pressedKeys.has('shift') ? .55 : 1);
    const dx = (Math.cos(state.yaw) * moveX - Math.sin(state.yaw) * moveY) * distance;
    const dz = (-Math.sin(state.yaw) * moveX - Math.cos(state.yaw) * moveY) * distance;
    if (!moveBy(dx, dz, false)) {
      if (Math.abs(dx) > 0.0001) moveBy(dx, 0, false);
      if (Math.abs(dz) > 0.0001) moveBy(0, dz, false);
    }
  }
  const keyboardLook = (pressedKeys.has('q') ? 1 : 0) - (pressedKeys.has('e') ? 1 : 0);
  const lookDirection = invertLook ? -1 : 1;
  state.targetYaw += (keyboardLook + joystickInput.lookX * lookDirection) * lookSpeed * delta;
  state.targetPitch = THREE.MathUtils.clamp(state.targetPitch + joystickInput.lookY * lookDirection * lookSpeed * 0.75 * delta, -MAX_PITCH, MAX_PITCH);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1700);
}

function openDialog(data) {
  if (EMBEDDED) {
    if (data.action === 'room' || data.action === 'hall') setZone(data.action);
    else if (data.kind === 'character') postHostIntent('character', { name: data.title, nearby: true });
    else postHostIntent('inspect', { title: data.title, body: data.body });
    return;
  }
  closeLeftDrawer();
  partyList.hidden = true;
  dialogBody.hidden = false;
  dialogPrimary.parentElement.hidden = false;
  state.dialogAction = data.action || null;
  dialogKicker.textContent = (data.kind || 'inspect').toUpperCase();
  dialogTitle.textContent = data.title || '对象';
  dialogBody.replaceChildren();
  const copy = document.createElement('p');
  copy.textContent = data.body || (data.kind === 'door' ? '门后连接一间采用同一结构的个人房。' : '这是当前空间中的可交互对象。');
  dialogBody.append(copy);
  if (data.kind === 'character') {
    const info = document.createElement('section');
    info.className = 'drawer-character-info';
    info.innerHTML = `<h3>人物信息</h3><p>${data.spec.height} cm · 相机正交纸片人</p><label>互动方式<textarea id="drawerInteractionMethod" maxlength="800" placeholder="描述想与她进行的互动"></textarea></label>`;
    dialogBody.append(info);
  }
  dialogPrimary.textContent = data.action === 'room' ? '进入房间' : data.action === 'hall' ? '返回大厅' : data.kind === 'character' ? '选择互动' : '确认';
  dialogLayer.setAttribute('aria-hidden', 'false');
  drawerScrim.classList.add('is-open');
  drawerScrim.setAttribute('aria-hidden', 'false');
  dialogPrimary.focus();
}

function openGallery() {
  closeLeftDrawer();
  state.dialogAction = null;
  partyList.hidden = true;
  dialogBody.hidden = false;
  dialogPrimary.parentElement.hidden = false;
  dialogKicker.textContent = 'UNLOCKED MATERIALS';
  dialogTitle.textContent = '阶段与相册素材';
  dialogBody.innerHTML = `<div class="gallery-grid">${stageGallery.map(([title, image, landscape]) => `
    <figure class="gallery-card${landscape ? ' is-landscape' : ''}">
      <img src="${image}" alt="${title}">
      <figcaption>${title}</figcaption>
    </figure>`).join('')}</div>`;
  dialogPrimary.textContent = '关闭预览';
  dialogLayer.setAttribute('aria-hidden', 'false');
  drawerScrim.classList.add('is-open');
  drawerScrim.setAttribute('aria-hidden', 'false');
  dialogPrimary.focus();
}

function openCharacterList() {
  closeLeftDrawer();
  state.dialogAction = null;
  dialogKicker.textContent = 'CHARACTERS';
  dialogTitle.textContent = '在场人物';
  renderParty();
  partyList.hidden = false;
  dialogBody.hidden = true;
  dialogPrimary.parentElement.hidden = true;
  dialogLayer.setAttribute('aria-hidden', 'false');
  drawerScrim.classList.add('is-open');
  drawerScrim.setAttribute('aria-hidden', 'false');
}

function openDecreeDrawer() {
  closeLeftDrawer();
  state.dialogAction = 'decree';
  partyList.hidden = true;
  dialogBody.hidden = false;
  dialogPrimary.parentElement.hidden = false;
  state.decreeMode = 'issue';
  renderDecreeForm();
  dialogPrimary.textContent = '提交法令';
  dialogLayer.setAttribute('aria-hidden', 'false');
  drawerScrim.classList.add('is-open');
  drawerScrim.setAttribute('aria-hidden', 'false');
}

function renderDecreeForm() {
  const modeLabels = { issue: '颁布法令', modify: '修改法令', revoke: '撤销法令' };
  dialogKicker.textContent = 'DECREE CONTROL';
  dialogTitle.textContent = modeLabels[state.decreeMode];
  const needsTarget = state.decreeMode !== 'issue';
  dialogBody.innerHTML = `<form class="decree-form">
    <div class="decree-segments">${[['issue','颁布'],['modify','修改'],['revoke','撤销']].map(([mode,label]) => `<button type="button" data-decree-mode="${mode}" class="${state.decreeMode === mode ? 'is-active' : ''}">${label}</button>`).join('')}</div>
    ${needsTarget ? '<label>目标法令<select id="drawerDecreeTarget"><option>当前没有可选的生效法令</option></select></label>' : '<label>法令标题<input id="drawerDecreeTitle" maxlength="40" placeholder="简短标题"></label>'}
    ${state.decreeMode === 'revoke' ? '<p>撤销后保留历史，并记录实际撤销者。</p>' : '<label>法令正文<textarea id="drawerDecreeBody" maxlength="1000" placeholder="一次只能包含一个核心规则"></textarea></label>'}
    <p>正式前端由本次按钮事务精确写入、回读校验并安装一次性提示。</p>
  </form>`;
  dialogPrimary.textContent = state.decreeMode === 'revoke' ? '确认撤销' : '提交法令';
}

function openLeftDrawer(kind) {
  closeDialog(false);
  leftDrawerTitle.textContent = kind === 'items' ? '法令物品' : '已有法令';
  leftDrawerBody.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'drawer-empty';
  empty.textContent = kind === 'items' ? '当前没有由生效法令投放的物品。' : '当前没有已经广播的法令。';
  leftDrawerBody.append(empty);
  leftDrawer.setAttribute('aria-hidden', 'false');
  drawerScrim.classList.add('is-open');
  drawerScrim.setAttribute('aria-hidden', 'false');
}

function closeLeftDrawer(clearScrim = true) {
  leftDrawer.setAttribute('aria-hidden', 'true');
  if (clearScrim && dialogLayer.getAttribute('aria-hidden') !== 'false') {
    drawerScrim.classList.remove('is-open');
    drawerScrim.setAttribute('aria-hidden', 'true');
  }
}

function closeDialog(clearScrim = true) {
  dialogLayer.setAttribute('aria-hidden', 'true');
  state.dialogAction = null;
  if (clearScrim && leftDrawer.getAttribute('aria-hidden') !== 'false') {
    drawerScrim.classList.remove('is-open');
    drawerScrim.setAttribute('aria-hidden', 'true');
  }
  viewport.focus();
}

function onSceneWheel(event) {
  if (Math.abs(event.deltaY) < 1 || !startManualControl()) return;
  event.preventDefault();
  const step = THREE.MathUtils.degToRad(5);
  state.targetPitch = THREE.MathUtils.clamp(state.targetPitch - Math.sign(event.deltaY) * step, -MAX_PITCH, MAX_PITCH);
}

function bindJoystick(node) {
  const kind = node.dataset.stick;
  const ring = node.querySelector('.joystick-ring');
  const thumb = node.querySelector('.joystick-thumb');
  let pointerId = null;

  function reset() {
    pointerId = null;
    thumb.style.transform = 'translate(-50%,-50%)';
    if (kind === 'move') joystickInput.moveX = joystickInput.moveY = 0;
    else joystickInput.lookX = joystickInput.lookY = 0;
  }

  function update(event) {
    if (event.pointerId !== pointerId) return;
    const rect = ring.getBoundingClientRect();
    const radius = rect.width * 0.31;
    if (radius < 1 || sceneInputBlocked()) return;
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
    thumb.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    if (kind === 'move') { joystickInput.moveX = dx / radius; joystickInput.moveY = -dy / radius; }
    else { joystickInput.lookX = dx / radius; joystickInput.lookY = -dy / radius; }
  }

  node.addEventListener('pointerdown', event => {
    if (!startManualControl()) return;
    viewport.focus({ preventScroll: true });
    pointerId = event.pointerId;
    node.setPointerCapture?.(pointerId);
    update(event);
  });
  node.addEventListener('pointermove', update);
  node.addEventListener('pointerup', reset);
  node.addEventListener('pointercancel', reset);
  node.addEventListener('lostpointercapture', reset);
  joystickResets.push(reset);
}

function onScenePointer(event) {
  if (sceneInputBlocked() || tableFocusMix > .01) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactives, false).find(entry => entry.object.visible !== false);
  if (!hit?.object?.userData?.kind) return;
  if (hit.object.userData.kind === 'table' && Math.hypot(camera.position.x, camera.position.z) <= TABLE_RADIUS + INTERACTION_RANGE) {
    postHostIntent('table-chat');
    return;
  }
  const worldPosition = new THREE.Vector3();
  hit.object.getWorldPosition(worldPosition);
  worldPosition.y = camera.position.y;
  if (worldPosition.distanceTo(camera.position) > INTERACTION_RANGE) {
    showToast('再靠近一点才能互动');
    return;
  }
  if (hit.object.userData.kind === 'door') {
    const i=hit.object.userData.doorIndex, door=doors[i];
    if (!door) return;
    const [side,r]=slotCoordinates(state.position.x,state.position.z,i);
    if(door.userData.open && Math.abs(side)<.65 && Math.abs(r-HALL_RADIUS-.21)<.48) {
      showToast('请先离开门洞'); return;
    }
    door.userData.open=!door.userData.open;
    return;
  }
  openDialog(hit.object.userData);
}

function dispatch(action) {
  if (/^(move|turn)-/.test(action) && !startManualControl()) return;
  if (EMBEDDED) {
    if (action === 'table-chat') { postHostIntent('table-chat'); return; }
    const hostAction = {
      'open-rules': 'rules', 'open-items': 'items', 'open-character-list': 'party',
      'open-decree': 'decree', 'open-actions': 'actions', 'daily': 'daily',
      'switch-simple': 'switch-simple', 'settings':'settings',
    }[action];
    if (hostAction) { postHostIntent(hostAction); return; }
    if (action === 'toggle-standees') return;
  }
  if (action === 'toggle-hints' || action === 'toggle-joysticks') {
    const key=action==='toggle-hints'?'hintsHidden':'joysticksHidden';
    root.dataset[key]=String(root.dataset[key]!=='true');
    return;
  }
  if (action === 'move-forward') moveForward(1);
  else if (action === 'move-back') moveForward(-1);
  else if (action === 'move-left') strafe(-1);
  else if (action === 'move-right') strafe(1);
  else if (action === 'turn-left') turn(1);
  else if (action === 'turn-right') turn(-1);
  else if (action === 'open-rules') openLeftDrawer('rules');
  else if (action === 'open-items') openLeftDrawer('items');
  else if (action === 'open-character-list') openCharacterList();
  else if (action === 'open-decree') openDecreeDrawer();
  else if (action === 'close-left-drawer') closeLeftDrawer();
  else if (action === 'close-drawers') {
    closeDialog(false);
    closeLeftDrawer(false);
    drawerScrim.classList.remove('is-open');
    drawerScrim.setAttribute('aria-hidden', 'true');
  }
  else if (action === 'zone-hall') setZone('hall');
  else if (action === 'zone-room') setZone('room');
  else if (action === 'toggle-map') {
    state.mapVisible = !state.mapVisible;
    miniMap.classList.toggle('is-hidden', !state.mapVisible);
  } else if (action === 'toggle-ruler') {
    state.rulerVisible = !state.rulerVisible;
    if (rulerGroup) rulerGroup.visible = state.rulerVisible;
    const label = root.querySelector('[data-kg-action="toggle-ruler"] small');
    if (label) label.textContent = state.rulerVisible ? '隐藏标尺' : '身高标尺';
  } else if (action === 'close-dialog') closeDialog();
  else if (action === 'open-gallery') openGallery();
  else if (action === 'dialog-primary') {
    if (state.dialogAction === 'room') setZone('room');
    else if (state.dialogAction === 'hall') setZone('hall');
    else if (state.dialogAction === 'decree') showToast('Demo只演示右侧法令面板，不发送生成请求');
    else showToast('Demo只演示前端交互，不发送剧情请求');
    closeDialog();
  }
}

root.addEventListener('click', event => {
  const decreeModeNode = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.decreeMode);
  if (decreeModeNode) {
    state.decreeMode = decreeModeNode.dataset.decreeMode;
    renderDecreeForm();
    return;
  }
  const actionNode = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.kgAction);
  if (!actionNode || actionNode.disabled) return;
  if (actionNode.dataset.kgAction === 'open-character') {
    const spec = characterSpecs.find(candidate => candidate.id === actionNode.dataset.characterId);
    if (spec) openDialog({ kind: 'character', title: spec.name, body: spec.note, spec, characterIndex: characterSpecs.indexOf(spec) });
    return;
  }
  dispatch(actionNode.dataset.kgAction);
});

window.addEventListener('keydown', event => {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey
    || event.target?.closest?.('input,textarea,select,[contenteditable]')) return;
  if (setControlKey(event.key.toLowerCase(), true)) event.preventDefault();
});
window.addEventListener('keyup', event => {
  if (setControlKey(event.key.toLowerCase(), false)) event.preventDefault();
});
window.addEventListener('blur', clearSceneInput);

renderer.domElement.addEventListener('pointerup', onScenePointer);
renderer.domElement.addEventListener('wheel', onSceneWheel, { passive: false });
root.querySelectorAll('.joystick').forEach(bindJoystick);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (dialogLayer.getAttribute('aria-hidden') === 'false' || leftDrawer.getAttribute('aria-hidden') === 'false')) {
    closeDialog(false);
    closeLeftDrawer(false);
    drawerScrim.classList.remove('is-open');
    drawerScrim.setAttribute('aria-hidden', 'true');
  } else if (event.key === 'Escape') postHostIntent('exit-immersive');
});

function renderParty() {
  partyList.innerHTML = characterSpecs.map(spec => `
    <button type="button" class="party-card" data-kg-action="open-character" data-character-id="${spec.id}">
      <img loading="lazy" crossorigin="anonymous" src="${spec.image}" alt="${spec.name}纸片人缩略图">
      <div><strong>${spec.name}${spec.role ? ` · ${spec.role}` : ''}</strong><small>${spec.height} cm · orthographic sprite</small></div>
      <em style="color:${spec.color}">●</em>
    </button>
  `).join('');
  partyList.querySelectorAll('img').forEach((image, index) => {
    image.addEventListener('error', () => {
      image.src = characterSpecs[index].fallbackImage;
    }, { once: true });
  });
}

function updateMiniMap() {
  const width = miniMap.width;
  const height = miniMap.height;
  mapContext.clearRect(0, 0, width, height);
  mapContext.fillStyle = 'rgba(7,8,10,.92)';
  mapContext.fillRect(0, 0, width, height);
  const padding = 22;
  const worldSize = 2 * (ROOM_CENTER + ROOM_SIZE / 2);
  const scale = (width - padding * 2) / worldSize;
  const project = (x, z) => [width / 2 + x * scale, height / 2 + z * scale];
  mapContext.strokeStyle = '#826d3f';
  mapContext.lineWidth = 3;
  {
    mapContext.beginPath();
    mapContext.arc(width/2,height/2,HALL_RADIUS*scale,0,Math.PI*2);
    mapContext.stroke();
    roomNames.forEach((_,i)=>{
      const [x,z]=slotPoint(i,0,ROOM_CENTER), [px,py]=project(x,z);
      mapContext.save();
      mapContext.translate(px,py);
      mapContext.rotate(-i*Math.PI/3);
      mapContext.strokeRect(-ROOM_SIZE*scale/2,-ROOM_SIZE*scale/2,ROOM_SIZE*scale,ROOM_SIZE*scale);
      mapContext.restore();
    });
    const [cx, cy] = project(0, 0);
    mapContext.fillStyle = 'rgba(207,174,95,.22)';
    mapContext.beginPath();
    mapContext.arc(cx, cy, TABLE_RADIUS * scale, 0, Math.PI * 2);
    mapContext.fill();
    billboards.forEach(mesh => {
      const spec=characterSpecs[mesh.userData.characterIndex];
      const [x, y] = project(mesh.position.x,mesh.position.z);
      mapContext.fillStyle = spec.color;
      mapContext.beginPath();
      mapContext.arc(x, y, 5, 0, Math.PI * 2);
      mapContext.fill();
    });
  }
  const [px, py] = project(state.position.x, state.position.z);
  mapContext.save();
  mapContext.translate(px, py);
  mapContext.rotate(-state.yaw);
  mapContext.fillStyle = '#f3e6c4';
  mapContext.beginPath();
  mapContext.moveTo(0, -10);
  mapContext.lineTo(7, 8);
  mapContext.lineTo(0, 4);
  mapContext.lineTo(-7, 8);
  mapContext.closePath();
  mapContext.fill();
  mapContext.restore();
}

function resize() {
  const rect = viewport.getBoundingClientRect();
  renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
  viewCamera.aspect = camera.aspect;
  viewCamera.updateProjectionMatrix();
}

// A camera-space decorative mesh. It has no world collider, input handler,
// raycast registration, animation tied to a weapon action, or gameplay state.
const viewScene = new THREE.Scene();
const viewCamera = new THREE.PerspectiveCamera(52,1,.04,6);
viewScene.add(new THREE.HemisphereLight(0xfff0db,0x4e596c,2.2));
const handKey = new THREE.DirectionalLight(0xffebd6,1.7);
handKey.position.set(-.6,1,.5);
viewScene.add(handKey);
let handDisplay;

function createHandDisplay() {
  const model = new THREE.Group();
  const weave = surfaceTexture(419,[220,217,208],23,true);
  configureTexture(weave,2,2);
  const leather = new THREE.MeshStandardMaterial({ color:0x454844,map:weave,roughness:.73 });
  const insert = new THREE.MeshStandardMaterial({ color:0x61645c,map:weave,roughness:.88 });
  const edging = new THREE.MeshStandardMaterial({ color:0x292c29,roughness:.78 });
  const thread = new THREE.MeshStandardMaterial({ color:0xa19a83,roughness:1 });
  const cloth = new THREE.MeshStandardMaterial({ color:0x53564b,map:weave,roughness:1 });
  const sphere = new THREE.SphereGeometry(1,24,14);
  const xAxis = new THREE.Vector3(1,0,0);
  const loft = (parent,sections,material,sides=16) => {
    const curve = new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(...s.slice(0,3))));
    const positions=[], uvs=[], indices=[];
    const rings = (sections.length-1)*5;
    for(let i=0;i<=rings;i++){
      const t=i/rings, k=Math.min(sections.length-2,Math.floor(t*(sections.length-1)));
      const mix=t*(sections.length-1)-k, a=sections[k], b=sections[k+1];
      const center=curve.getPoint(t), tangent=curve.getTangent(t);
      const widthAxis=xAxis.clone().addScaledVector(tangent,-xAxis.dot(tangent)).normalize();
      const depthAxis=tangent.clone().cross(widthAxis).normalize();
      const width=THREE.MathUtils.lerp(a[3],b[3],mix), depth=THREE.MathUtils.lerp(a[4],b[4],mix);
      for(let j=0;j<=sides;j++){
        const angle=j/sides*Math.PI*2;
        const p=center.clone().addScaledVector(widthAxis,Math.cos(angle)*width).addScaledVector(depthAxis,Math.sin(angle)*depth);
        positions.push(...p.toArray()); uvs.push(j/sides,t);
        if(i&&j){
          const d=i*(sides+1)+j, c=d-1, b=d-sides-1, a=b-1;
          indices.push(a,b,c,b,d,c);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    parent.add(new THREE.Mesh(geometry,material));
  };
  const pad = (parent,x,y,z,w,h,d,material) => {
    const mesh=new THREE.Mesh(sphere,material);
    mesh.position.set(x,y,z); mesh.scale.set(w,h,d);
    parent.add(mesh); return mesh;
  };
  const hands = [-1,1].map(sign=>{
    const hand = new THREE.Group();
    hand.scale.x=sign;
    hand.rotation.set(sign<0?.16:.08,sign*.16,sign*.09);
    model.add(hand);
    loft(hand,[[.031,-.087,.176,.052,.041],[.015,-.047,.096,.047,.035],[0,-.013,.024,.036,.027]],cloth,20);
    loft(hand,[[.01,-.028,.063,.044,.033],[.007,-.023,.058,.045,.034],[.001,-.011,.025,.035,.028],[0,-.009,.021,.033,.026]],edging);
    loft(hand,[[0,-.009,.027,.031,.024],[0,-.003,.003,.033,.021],[-.001,.001,-.035,.043,.020],[0,.001,-.067,.042,.017],[0,0,-.085,.035,.011],[0,-.004,-.092,.025,.001]],leather,22);
    pad(hand,.001,.018,-.037,.030,.005,.030,insert).rotation.z=.10;
    pad(hand,.001,.010,.033,.027,.006,.015,insert);
    // The palm backs have separate padded panels; each digit uses one
    // continuous tapered skin, with uneven length and flexion.
    const digits=[
      [-.028,.067,.016,-.006],[-.009,.083,.011,-.002],[.010,.075,.015,.003],[.029,.055,.025,.010],
    ];
    digits.forEach(([x,length,bend,splay],i)=>{
      const base=-.072+Math.abs(x)*.29, r=.010-i*.00045;
      loft(hand,[
        [x,0,base,r,.011],
        [x+splay*.42,-.003,base-length*.35,r*.96,.009],
        [x+splay*.76,-bend*.56,base-length*.72,r*.77,.0075],
        [x+splay,-bend,base-length*.94,r*.60,.006],
        [x+splay,-bend-.002,base-length,.0007,.0007]
      ],leather,14);
      pad(hand,x+splay*.23,.011,base-length*.19,r*.78,.003,.009,insert);
      for(let j=0;j<3;j++) pad(hand,x-.005+j*.005,.013,base-.006,.0016,.0011,.0022,thread);
    });
    loft(hand,[[-.026,-.003,-.021,.014,.013],[-.045,-.007,-.034,.013,.012],[-.060,-.017,-.052,.009,.010],[-.066,-.025,-.061,.006,.007],[-.067,-.027,-.065,.0007,.0007]],leather,16);
    for(let j=0;j<9;j++){
      const z=-.061+j*.0058;
      pad(hand,-.027+.012*(j/8),.021,z,.0017,.001,.0020,thread);
      pad(hand,.026-.009*(j/8),.020,z,.0017,.001,.0020,thread);
    }
    return hand;
  });
  model.userData.hands=hands;
  viewScene.add(model);
  return model;
}

function renderHandDisplay(time) {
  if (!showHands || tableFocusMix > .01 || hostOverlayBlocked) return;
  if (!handDisplay) handDisplay = createHandDisplay();
  const horizontal = Math.tan(THREE.MathUtils.degToRad(viewCamera.fov/2))*viewCamera.aspect;
  const sway = reduceMotion.matches ? 0 : Math.sin(time*.0019)*.003;
  const spacing=Math.min(.22,horizontal*.36);
  const [left,right]=handDisplay.userData.hands;
  left.position.set(-spacing,-.014,.014);
  right.position.set(spacing,.005,-.012);
  handDisplay.position.set(0,-.197+sway,-.61);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(viewScene,viewCamera);
  renderer.autoClear = true;
}

new ResizeObserver(resize).observe(viewport);
window.addEventListener('resize', resize);

let previousTime = performance.now();
const shotCamera = new THREE.PerspectiveCamera();
const paperCamera = new THREE.PerspectiveCamera();
paperCamera.up.set(0,0,-1);
const shotTarget = new THREE.Vector3(0, .87, 0);
const portalPosition = new THREE.Vector3(0,EYE_HEIGHT,HALL_RADIUS + .27);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let lastTableProjection = '';
let lastPose = '';
let lastPoseAt = 0;
let entryPoseApplied = false;
const PAPER_WIDTH = 3.04, PAPER_DEPTH = 2.34, PAPER_Y = .823;
let paperProgress = 0;
const scroll = new THREE.Group();
const paperMap = surfaceTexture(137,[224,201,155],10);
paperMap.colorSpace = THREE.SRGBColorSpace;
const parchment = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_WIDTH,PAPER_DEPTH),
  new THREE.MeshBasicMaterial({ map:paperMap }));
parchment.rotation.x = -Math.PI / 2;
parchment.position.y = PAPER_Y;
scroll.add(parchment);
const rollers = [-1,1].map(() => {
  const axle = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.051,.051,PAPER_DEPTH+.08,24), materials.tableSide);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(.073,.073,PAPER_DEPTH,24), parchment.material);
  core.rotation.x = roll.rotation.x = Math.PI / 2;
  axle.add(core,roll);
  axle.position.y = PAPER_Y + .066;
  scroll.add(axle);
  return axle;
});
scroll.visible = false;

function updateTableScroll(renderScene, delta) {
  const atTable = tableFocus && tableFocusMix >= 1;
  if (reduceMotion.matches) paperProgress = atTable ? 1 : 0;
  else paperProgress = THREE.MathUtils.clamp(paperProgress + (atTable ? delta/.48 : -delta/.3),0,1);
  scroll.visible = paperProgress > 0;
  if (!scroll.visible) return;
  if (scroll.parent !== renderScene) renderScene.add(scroll);
  const reveal = easeTravel(paperProgress);
  const right = PAPER_WIDTH / 2;
  parchment.scale.x = Math.max(.001,reveal);
  parchment.position.x = right * (1-reveal);
  rollers[0].position.x = right - PAPER_WIDTH * reveal;
  rollers[1].position.x = right;
  rollers[0].rotation.z = -reveal * Math.PI * 2;
}

function publishScenePose(time) {
  if (!EMBEDDED || tableFocusMix > 0 || time - lastPoseAt < 120) return;
  const pose = { zone:state.zone, x:state.position.x, z:state.position.z, yaw:state.yaw, pitch:state.pitch };
  const key = JSON.stringify(pose);
  if (key === lastPose) return;
  lastPose = key;
  lastPoseAt = time;
  window.parent.postMessage({ type:'king-game-3d:scene-pose', pose }, '*');
}

function applyEntryPose(pose) {
  if (entryPoseApplied || !pose || pose.zone !== state.zone ||
      ![pose.x,pose.z,pose.yaw,pose.pitch].every(Number.isFinite) || !validPosition(pose.x,pose.z)) return;
  state.position.set(pose.x,EYE_HEIGHT,pose.z);
  state.targetPosition.copy(state.position);
  state.yaw = state.targetYaw = pose.yaw % (Math.PI * 2);
  state.pitch = state.targetPitch = THREE.MathUtils.clamp(pose.pitch,-MAX_PITCH,MAX_PITCH);
  entryPoseApplied = true;
}

function publishTableProjection() {
  if (!EMBEDDED) return;
  let rect = null;
  if (tableFocus && paperProgress >= 1) {
    rect = {left:0,top:0,width:1,height:1};
  }
  const key = JSON.stringify(rect);
  if (key === lastTableProjection) return;
  lastTableProjection = key;
  window.parent.postMessage({ type: 'king-game-3d:table-projection', rect }, '*');
}

function easeTravel(t) { return t * t * (3 - 2 * t); }

function animate(time) {
  const delta = Math.min(0.05, (time - previousTime) / 1000);
  previousTime = time;
  if (EMBEDDED && !hostActive) { requestAnimationFrame(animate); return; }
  applyContinuousControls(delta);
  const positionBlend = 1 - Math.exp(-delta * 12);
  state.targetPosition.y = pressedKeys.has('shift') ? 1.08 : EYE_HEIGHT;
  state.position.lerp(state.targetPosition, positionBlend);
  updateSpace();
  doors.forEach(door=>{
    const hinge=door.userData.hinge;
    hinge.rotation.y+=( (door.userData.open?1.48:0)-hinge.rotation.y )*positionBlend;
  });
  let yawDifference = ((state.targetYaw - state.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (yawDifference < -Math.PI) yawDifference += Math.PI * 2;
  state.yaw += yawDifference * positionBlend;
  state.pitch += (state.targetPitch - state.pitch) * positionBlend;
  camera.position.copy(state.position);
  camera.rotation.set(state.pitch, state.yaw, 0);
  const focusGoal = tableFocus ? 1 : 0;
  const roomTravel = state.zone !== 'hall';
  tableFocusMix = reduceMotion.matches ? focusGoal
    : THREE.MathUtils.clamp(tableFocusMix + (tableFocus ? 1 : -1) * delta / (roomTravel ? 2.3 : 1.35), 0, 1);
  const renderScene = scene;
  if (tableFocusMix > 0) {
    const approach=Math.min(1,tableFocusMix/.72);
    const angle=roomTravel?activeRoom*Math.PI/3+Math.PI:Math.atan2(state.position.x,state.position.z);
    shotCamera.position.set(Math.sin(angle)*3.45,1.91,Math.cos(angle)*3.45);
    shotCamera.lookAt(shotTarget);
    if (roomTravel) {
      const [x,z]=slotPoint(activeRoom,0,HALL_RADIUS+.20);
      portalPosition.set(x,EYE_HEIGHT,z);
      if (approach<.42) {
        const t=easeTravel(approach/.42);
        camera.position.lerp(portalPosition,t);
        camera.quaternion.slerp(shotCamera.quaternion,t);
      } else {
        const t=easeTravel((approach-.42)/.58);
        camera.position.copy(portalPosition).lerp(shotCamera.position,t);
        camera.quaternion.copy(shotCamera.quaternion);
      }
    } else {
      const t=easeTravel(approach);
      camera.position.lerp(shotCamera.position,t);
      camera.quaternion.slerp(shotCamera.quaternion,t);
    }
    if(tableFocusMix>.72) {
      const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
      const height=.96*Math.min(PAPER_WIDTH/camera.aspect,PAPER_DEPTH)/(2*Math.tan(halfFov));
      paperCamera.position.set(0,PAPER_Y+height,0);
      paperCamera.lookAt(0,PAPER_Y,0);
      const t=easeTravel((tableFocusMix-.72)/.28);
      camera.position.lerp(paperCamera.position,t);
      camera.quaternion.slerp(paperCamera.quaternion,t);
    }
  }
  for (const child of world.children) {
    if(child.userData.overheadOccluder) child.visible=camera.position.y<WALL_HEIGHT-.09;
  }
  billboards.forEach(mesh=>mesh.lookAt(camera.position.x,mesh.position.y,camera.position.z));
  updateMiniMap();
  updateTableScroll(renderScene,delta);
  renderer.render(renderScene, camera);
  renderHandDisplay(time);
  publishTableProjection();
  publishScenePose(time);
  requestAnimationFrame(animate);
}

renderParty();
setZone('hall');
if (EMBEDDED) {
  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'king-game-3d:snapshot') {
      applyHostSnapshot(event.data.state);
      applyEntryPose(event.data.entryPose);
    }
    else if (event.data?.type === 'king-game-3d:overlay') {
      hostOverlayBlocked = event.data.blocked === true;
      const inset = THREE.MathUtils.clamp(Number(event.data.chatInset) || 0, 0, window.innerHeight);
      root.style.setProperty('--table-chat-inset', inset + 'px');
      root.dataset.chatOpen = String(inset > 0);
      root.querySelectorAll('.joystick').forEach(stick => {
        stick.style.bottom = inset > 0 ? (inset + 6) + 'px' : '';
      });
      if (hostOverlayBlocked) clearSceneInput();
    } else if (event.data?.type === 'king-game-3d:table-focus') {
      setTableFocus(event.data.active === true);
      if (tableFocus) clearSceneInput();
    } else if (event.data?.type === 'king-game-3d:key') {
      setControlKey(event.data.key, event.data.down === true);
    } else if (event.data?.type === 'king-game-3d:focus-viewport') {
      viewport.focus({ preventScroll: true });
    } else if (event.data?.type === 'king-game-3d:menu-action') {
      const action=event.data.action;
      if (hostActive && !hostOverlayBlocked && ['table-chat','open-character-list','open-rules','open-items','daily','open-decree','open-actions','toggle-map','toggle-hints','toggle-joysticks','switch-simple'].includes(action)) dispatch(action);
    } else if (event.data?.type === 'king-game-3d:preferences') {
      applyScenePreferences(event.data.preferences);
    } else if (event.data?.type === 'king-game-3d:menu-failed') {
      root.dataset.petMenuFailed='true';
    } else if (event.data?.type === 'king-game-3d:active') {
      hostActive = event.data.active === true;
      if (!hostActive) clearSceneInput();
    }
  });
  window.parent.postMessage({ type: 'king-game-3d:ready' }, '*');
}
resize();
loadingState.classList.add('is-hidden');
setTimeout(() => loadingState.remove(), 420);
viewport.focus();
requestAnimationFrame(animate);
