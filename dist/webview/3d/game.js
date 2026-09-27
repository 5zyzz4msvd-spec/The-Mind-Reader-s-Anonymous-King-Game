import * as THREE from './vendor/three.module.min.js';

const DEMO_CANARY = 'king-game:pseudo3d:0.6.5';
const EMBEDDED = window.__KING_GAME_3D_EMBEDDED__ === true || new URLSearchParams(location.search).get('embedded') === '1';
const root = document.querySelector('#kg-game');
root.dataset.runtimeCanary = DEMO_CANARY;
root.dataset.embedded = EMBEDDED ? 'true' : 'false';
let hostSnapshot = null;
let hostOverlayBlocked = false;
let hostActive = true;

function postHostIntent(action, extra = {}) {
  if (!EMBEDDED || window.parent === window) return false;
  window.parent.postMessage({ type: 'king-game-3d:intent', action, ...extra }, '*');
  return true;
}

function secondStageUnlocked(name) {
  if (!EMBEDDED || !hostSnapshot) return state.secondStandees;
  const system = hostSnapshot.系统 || {};
  const keys = {
    '林安': '_侦探日记已解锁', '穆裳希': '_创业事迹已解锁',
    '张曲溪': '_风流相册已解锁', '王可可': '_王可可嫉妒立绘',
    '许知夏': '_许知夏完全信赖已解锁',
  };
  return system[keys[name]] === true;
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
const HALL_SIZE = 15 * TILE;
const ROOM_SIZE = 7 * TILE;
const TABLE_RADIUS = 2;
const CEILING_LIGHT_HEIGHT = WALL_HEIGHT - 0.055;
const INTERACTION_RANGE = 1.85;
const MOVE_SPEED = 2.35;
const LOOK_SPEED = 1.9;
const MAX_PITCH = Math.PI / 3;

const characterSpecs = [
  { id: 'lin', name: '林安', height: 169, image: './assets/runtime/lin-an-anime-v8.png', secondImage: './assets/runtime/lin-an-anime-stage2-v1.png', color: '#65c7b7', position: [-2.75, -1.35], note: '散乱长发垂在肩侧，她拿着只有一个帽檐的棕色鸭舌帽，露出毫无算计感的明亮笑容。' },
  { id: 'mu', name: '穆裳希', height: 172, image: './assets/runtime/mu-shangxi-anime-v2.png', secondImage: './assets/runtime/mu-shangxi-anime-stage2-v1.png', color: '#8da6e8', position: [2.7, -1.25], note: '她仍束着纯白色长发、穿着酒红色长裤，只多了一副细框眼镜。' },
  { id: 'zhang', name: '张曲溪', height: 175, image: './assets/runtime/zhang-quxi-anime-v2.png', secondImage: './assets/runtime/zhang-quxi-anime-stage2-v1.png', color: '#e17897', position: [-2.7, 1.75], note: '她抬起双臂露出两侧浓密腋毛，工装裤下拉到短裤以下。' },
  { id: 'wang', name: '王可可', height: 168, image: './assets/runtime/wang-keke-anime-v4.png', secondImage: './assets/runtime/wang-keke-anime-stage2-v1.png', color: '#c697ed', position: [2.65, 1.8], note: '嫉妒阶段的她歪着肩胯挡路，扬起下巴露出挑衅神情。' },
  { id: 'zhixia', name: '许知夏', role: '住校大学生', height: 162, image: './assets/runtime/xu-zhixia-anime-v1.png', secondImage: './assets/runtime/xu-zhixia-anime-stage2-v1.png', color: '#f0b36a', position: [0, -3.15], note: '十九岁的住校大学生许知夏穿灰青Polo衫与深蓝短裤；陌生密室里，她信赖此前认真为自己推荐饭店的玩家。' },
];

const stageGallery = [
  ['林安 · 圆桌反应', './assets/stage/runtime/lin-an-stage-anime-v1.webp', false],
  ['穆裳希 · 走廊反应', './assets/stage/runtime/mu-shangxi-stage-anime-v1.webp', false],
  ['张曲溪 · 大厅反应', './assets/stage/runtime/zhang-quxi-stage-anime-v1.webp', false],
  ['王可可 · 供给窗反应', './assets/stage/runtime/wang-keke-stage-anime-v1.webp', false],
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
  secondStandees: false,
  dialogAction: null,
  decreeMode: 'issue',
  moving: false,
};

const world = new THREE.Group();
scene.add(world);
const billboards = [];
const interactives = [];
const interactiveHighlights = new Map();
let rulerGroup = null;
let toastTimer = null;
const pressedKeys = new Set();
const joystickInput = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };

function registerInteractive(object) {
  interactives.push(object);
  const helper = new THREE.BoxHelper(object, 0xf4c95d);
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.material.opacity = 0.95;
  helper.renderOrder = 20;
  helper.visible = false;
  world.add(helper);
  interactiveHighlights.set(object, helper);
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

const [wallTexture, floorTexture, tableTexture, ...loadedCharacterTextures] = await Promise.all([
  textureLoader.loadAsync('./assets/runtime/wall-clean-v1.webp'),
  textureLoader.loadAsync('./assets/runtime/floor-graphite-v1.webp'),
  textureLoader.loadAsync('./assets/runtime/tabletop-charcoal-v1.webp'),
  ...characterSpecs.map(character => textureLoader.loadAsync(character.image)),
  ...characterSpecs.map(character => textureLoader.loadAsync(character.secondImage)),
]);

const characterTextures = loadedCharacterTextures.slice(0, characterSpecs.length);
const secondCharacterTextures = loadedCharacterTextures.slice(characterSpecs.length);

configureTexture(wallTexture, 5, 2);
configureTexture(floorTexture, 7, 7);
configureTexture(tableTexture, 1, 1);
[...characterTextures, ...secondCharacterTextures].forEach(texture => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
});

const materials = {
  wall: new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xe6dfcf, roughness: 0.92, metalness: 0 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTexture, color: 0x777777, roughness: 0.88, metalness: 0.02 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 1, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.68, metalness: 0.22 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x9a7839, roughness: 0.48, metalness: 0.56 }),
  tableTop: new THREE.MeshStandardMaterial({ map: tableTexture, color: 0x6f6555, roughness: 0.54, metalness: 0.18 }),
  tableSide: new THREE.MeshStandardMaterial({ color: 0x191a1d, roughness: 0.48, metalness: 0.28 }),
  chairFrame: new THREE.MeshStandardMaterial({ color: 0xb88a4c, roughness: 0.48, metalness: 0.42 }),
  chairSeat: new THREE.MeshStandardMaterial({ color: 0x9f493d, roughness: 0.82, metalness: 0.02 }),
  doorFrame: new THREE.MeshStandardMaterial({ color: 0x8998a1, roughness: 0.42, metalness: 0.5 }),
  doorPanel: new THREE.MeshStandardMaterial({ color: 0x3e505b, roughness: 0.66, metalness: 0.28 }),
  doorInset: new THREE.MeshStandardMaterial({ color: 0x526772, roughness: 0.72, metalness: 0.18 }),
  hatchSeam: new THREE.MeshStandardMaterial({ color: 0x34383a, roughness: 0.9, metalness: 0.12 }),
  ceilingLight: new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xffe7b3, emissiveIntensity: 2.4, roughness: 0.34, metalness: 0 }),
  ceilingLightRim: new THREE.MeshStandardMaterial({ color: 0x4c4b48, roughness: 0.52, metalness: 0.46 }),
};

scene.add(new THREE.HemisphereLight(0xe9edf0, 0x25282e, 0.9));
const ceilingLight = new THREE.PointLight(0xffedc7, 7.5, 18, 2);
ceilingLight.position.set(0, CEILING_LIGHT_HEIGHT, 0);
scene.add(ceilingLight);

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

function addFloor(size) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  world.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(size, size), materials.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  world.add(ceiling);
  const lightRadius = size > ROOM_SIZE ? 1.08 : 0.68;
  const lightRim = new THREE.Mesh(new THREE.RingGeometry(lightRadius, lightRadius + 0.055, 64), materials.ceilingLightRim);
  lightRim.rotation.x = Math.PI / 2;
  lightRim.position.y = CEILING_LIGHT_HEIGHT - 0.004;
  world.add(lightRim);
  const lightPanel = new THREE.Mesh(new THREE.CircleGeometry(lightRadius, 64), materials.ceilingLight);
  lightPanel.rotation.x = Math.PI / 2;
  lightPanel.position.y = CEILING_LIGHT_HEIGHT - 0.006;
  world.add(lightPanel);
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

function addDoor(name, x, z, yaw, action = 'room') {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  world.add(group);
  addBox({ size: [1.06, 2.12, 0.1], position: [0, 1.06, 0], material: materials.doorPanel, parent: group, data: { kind: 'door', title: name, action } });
  addBox({ size: [0.82, 1.35, 0.025], position: [0, 0.93, 0.061], material: materials.doorInset, parent: group });
  addBox({ size: [0.025, 1.25, 0.035], position: [0, 0.93, 0.082], material: materials.doorFrame, parent: group });
  addBox({ size: [0.1, 2.28, 0.18], position: [-0.59, 1.14, 0], material: materials.doorFrame, parent: group });
  addBox({ size: [0.1, 2.28, 0.18], position: [0.59, 1.14, 0], material: materials.doorFrame, parent: group });
  addBox({ size: [1.28, 0.1, 0.18], position: [0, 2.23, 0], material: materials.doorFrame, parent: group });
  addBox({ size: [0.11, 0.24, 0.035], position: [0.39, 1.03, 0.085], material: materials.trim, parent: group });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 16), materials.trim);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.39, 1.03, 0.13);
  group.add(handle);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.2), new THREE.MeshBasicMaterial({ map: labelTexture(name), transparent: true }));
  label.position.set(0, 1.73, 0.075);
  group.add(label);
}

function addClosedSupplyHatch(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  world.add(group);
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

function addWallToilet(x, z) {
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.78, metalness: 0.02 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  world.add(group);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.38, 28), porcelain);
  bowl.position.set(0, 0.2, 0.08);
  bowl.userData = { kind: 'prop', title: '靠墙马桶', body: '房间不设厕所隔墙，只有一只马桶直接靠墙安装。' };
  registerInteractive(bowl);
  group.add(bowl);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 10, 32), porcelain);
  seat.rotation.x = Math.PI / 2;
  seat.scale.z = 0.82;
  seat.position.set(0, 0.41, 0.08);
  group.add(seat);
  addBox({ size: [0.5, 0.54, 0.2], position: [0, 0.66, -0.19], material: porcelain, parent: group });
}

function addRoundTable() {
  const tableGroup = new THREE.Group();
  tableGroup.userData = { kind: 'table', title: '六人圆桌', action: null };
  const topGeometry = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.1, 64);
  const top = new THREE.Mesh(topGeometry, [materials.tableSide, materials.tableTop, materials.tableSide]);
  top.position.y = 0.76;
  top.userData = tableGroup.userData;
  registerInteractive(top);
  tableGroup.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_RADIUS - 0.04, 0.035, 12, 64), materials.trim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.82;
  tableGroup.add(rim);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 0.7, 32), materials.tableSide);
  pedestal.position.y = 0.35;
  tableGroup.add(pedestal);
  world.add(tableGroup);

  for (let index = 0; index < 6; index += 1) {
    const angle = -Math.PI / 2 + Math.PI / 6 + index * Math.PI * 2 / 6;
    const chair = new THREE.Group();
    chair.position.set(Math.cos(angle) * 2.72, 0, Math.sin(angle) * 2.72);
    chair.rotation.y = -angle + Math.PI / 2;
    addBox({ size: [0.6, 0.08, 0.56], position: [0, 0.47, 0], material: materials.chairSeat, parent: chair });
    for (const x of [-0.245, 0.245]) {
      for (const z of [-0.215, 0.215]) {
        addBox({ size: [0.052, 0.46, 0.052], position: [x, 0.23, z], material: materials.chairFrame, parent: chair });
      }
      addBox({ size: [0.052, 0.78, 0.052], position: [x, 0.75, 0.255], material: materials.chairFrame, parent: chair });
    }
    addBox({ size: [0.5, 0.075, 0.052], position: [0, 0.82, 0.255], material: materials.chairFrame, parent: chair });
    addBox({ size: [0.5, 0.075, 0.052], position: [0, 1.02, 0.255], material: materials.chairFrame, parent: chair });
    world.add(chair);
  }
}

function applyCharacterTexture(mesh, characterIndex, useSecondStage) {
  const texture = useSecondStage ? secondCharacterTextures[characterIndex] : characterTextures[characterIndex];
  const spec = characterSpecs[characterIndex];
  const height = spec.height / 100;
  const aspect = texture.image.width / texture.image.height;
  mesh.material.map = texture;
  mesh.material.needsUpdate = true;
  mesh.scale.set(height * aspect, height, 1);
  mesh.position.y = height / 2 + 0.012;
}

function addCharacter(spec, texture, x, z, characterIndex) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: true, depthTest: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  applyCharacterTexture(mesh, characterIndex, secondStageUnlocked(spec.name));
  mesh.position.x = x;
  mesh.position.z = z;
  mesh.userData = { kind: 'character', title: spec.name, body: spec.note, spec, characterIndex };
  registerInteractive(mesh);
  billboards.push(mesh);
  world.add(mesh);
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

function clearWorld() {
  while (world.children.length) {
    const child = world.children.pop();
    child.traverse?.(node => node.geometry?.dispose?.());
  }
  billboards.length = 0;
  interactives.length = 0;
  interactiveHighlights.clear();
  rulerGroup = null;
}

function buildHall() {
  clearWorld();
  addFloor(HALL_SIZE);
  const half = HALL_SIZE / 2;
  addBox({ size: [HALL_SIZE + 0.2, WALL_HEIGHT, 0.15], position: [0, WALL_HEIGHT / 2, -half] });
  addBox({ size: [HALL_SIZE + 0.2, WALL_HEIGHT, 0.15], position: [0, WALL_HEIGHT / 2, half] });
  addBox({ size: [0.15, WALL_HEIGHT, HALL_SIZE], position: [-half, WALL_HEIGHT / 2, 0] });
  addBox({ size: [0.15, WALL_HEIGHT, HALL_SIZE], position: [half, WALL_HEIGHT / 2, 0] });
  addDoor('林安', -3.6, -half + 0.09, 0);
  addDoor('穆裳希', 0, -half + 0.09, 0);
  addDoor('张曲溪', 3.6, -half + 0.09, 0);
  addDoor('王可可', half - 0.09, 1.4, -Math.PI / 2);
  addDoor('许知夏', -half + 0.09, 1.4, Math.PI / 2);
  addDoor('你的房间', 0, half - 0.09, Math.PI);
  addRoundTable();
  characterSpecs.forEach((spec, index) => addCharacter(spec, characterTextures[index], spec.position[0], spec.position[1], index));
  addRuler(-5.1, -1.8);
  state.position.set(0, EYE_HEIGHT, 4.65);
  state.targetPosition.copy(state.position);
  state.yaw = 0;
  state.targetYaw = 0;
  state.pitch = 0;
  state.targetPitch = 0;
}

function buildRoom() {
  clearWorld();
  addFloor(ROOM_SIZE);
  const half = ROOM_SIZE / 2;
  addBox({ size: [ROOM_SIZE + 0.2, WALL_HEIGHT, 0.15], position: [0, WALL_HEIGHT / 2, -half] });
  addBox({ size: [ROOM_SIZE + 0.2, WALL_HEIGHT, 0.15], position: [0, WALL_HEIGHT / 2, half] });
  addBox({ size: [0.15, WALL_HEIGHT, ROOM_SIZE], position: [-half, WALL_HEIGHT / 2, 0] });
  addBox({ size: [0.15, WALL_HEIGHT, ROOM_SIZE], position: [half, WALL_HEIGHT / 2, 0] });
  addDoor('返回大厅', 0, half - 0.09, Math.PI, 'hall');

  addBox({ size: [1.95, 0.45, 0.95], position: [1.25, 0.28, -1.35], material: new THREE.MeshStandardMaterial({ color: 0x656b72, roughness: 0.86 }), data: { kind: 'prop', title: '单人床', body: '床面高约0.52米，床下没有可见储物空间。' } });
  addClosedSupplyHatch(1.2, 1.18, -half + 0.086);
  addWallToilet(-1.72, -half + 0.44);
  addCharacter(characterSpecs[3], characterTextures[3], 0.65, 0.2, 3);
  addRuler(-2.35, 0.3);
  state.position.set(0, EYE_HEIGHT, 2.05);
  state.targetPosition.copy(state.position);
  state.yaw = 0;
  state.targetYaw = 0;
  state.pitch = 0;
  state.targetPitch = 0;
}

function setZone(zone) {
  state.zone = zone === 'room' ? 'room' : 'hall';
  if (state.zone === 'hall') buildHall(); else buildRoom();
  zoneLabel.textContent = state.zone === 'hall' ? '中央大厅' : '个人房间';
  locationTag.textContent = state.zone === 'hall' ? '中央大厅 · 南侧' : '个人房间 · 门边';
  root.querySelectorAll('[data-kg-action^="zone-"]').forEach(button => button.classList.toggle('is-active', button.dataset.kgAction === `zone-${state.zone}`));
  updateMiniMap();
  showToast(state.zone === 'hall' ? '已进入中央大厅' : '已进入个人房间演示');
}

function applyHostSnapshot(snapshot) {
  if (!EMBEDDED || !snapshot || typeof snapshot !== 'object') return;
  const firstSnapshot = hostSnapshot === null;
  hostSnapshot = snapshot;
  const system = snapshot.系统 || {};
  const playerLocation = String(snapshot.玩家?.地点 || system.当前地点 || '');
  const desiredZone = playerLocation.includes('大厅') ? 'hall' : 'room';
  if (firstSnapshot || desiredZone !== state.zone) setZone(desiredZone);
  billboards.forEach(mesh => {
    const spec = characterSpecs[mesh.userData.characterIndex];
    const location = String(snapshot.角色?.[spec.name]?.地点 || '');
    mesh.visible = !location || (state.zone === 'hall' ? location.includes('大厅') : /玩家房间|个人房间|你的房间/.test(location));
    applyCharacterTexture(mesh, mesh.userData.characterIndex, secondStageUnlocked(spec.name));
  });
  const dayNode = root.querySelector('.scene-clock span');
  const timeNode = root.querySelector('.scene-clock b');
  if (dayNode) dayNode.textContent = `第 ${Number(system._当前天数 || 1)} 日`;
  if (timeNode) timeNode.textContent = String(system.当前时间 || '').replace(/^第\d+日\s*/, '') || '—';
  const daily = root.querySelector('[data-kg-action="daily"]');
  if (daily) {
    daily.hidden = system._每日阶段 !== '待颁布法令' && system._可过夜 !== true;
    const label = daily.querySelector('small');
    if (label) label.textContent = system._每日阶段 === '待颁布法令' ? '开始法令' : '过夜';
  }
  const decree = root.querySelector('[data-kg-action="open-decree"]');
  if (decree) decree.hidden = system._每日阶段 !== '待颁布法令';
}

function validPosition(x, z) {
  const half = (state.zone === 'hall' ? HALL_SIZE : ROOM_SIZE) / 2 - 0.34;
  if (Math.abs(x) > half || Math.abs(z) > half) return false;
  if (state.zone === 'hall' && Math.hypot(x, z) < TABLE_RADIUS + 0.48) return false;
  return true;
}

function moveBy(dx, dz, notify = true) {
  const x = state.targetPosition.x + dx;
  const z = state.targetPosition.z + dz;
  if (!validPosition(x, z)) {
    if (notify) showToast(state.zone === 'hall' && Math.hypot(x, z) < TABLE_RADIUS + 0.48 ? '圆桌阻挡了前进路线' : '已经靠近墙面');
    return false;
  }
  state.targetPosition.set(x, EYE_HEIGHT, z);
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
  return hostOverlayBlocked || dialogLayer.getAttribute('aria-hidden') === 'false'
    || leftDrawer.getAttribute('aria-hidden') === 'false'
    || active?.matches?.('input,textarea,select,[contenteditable="true"]');
}

function applyContinuousControls(delta) {
  if (sceneInputBlocked()) return;
  let moveX = joystickInput.moveX + (pressedKeys.has('d') ? 1 : 0) - (pressedKeys.has('a') ? 1 : 0);
  let moveY = joystickInput.moveY + (pressedKeys.has('w') || pressedKeys.has('arrowup') ? 1 : 0) - (pressedKeys.has('s') || pressedKeys.has('arrowdown') ? 1 : 0);
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude; }
  if (magnitude > 0.01) {
    const distance = MOVE_SPEED * delta;
    const dx = (Math.cos(state.yaw) * moveX - Math.sin(state.yaw) * moveY) * distance;
    const dz = (-Math.sin(state.yaw) * moveX - Math.cos(state.yaw) * moveY) * distance;
    if (!moveBy(dx, dz, false)) {
      if (Math.abs(dx) > 0.0001) moveBy(dx, 0, false);
      if (Math.abs(dz) > 0.0001) moveBy(0, dz, false);
    }
  }
  const keyboardLook = (pressedKeys.has('q') ? 1 : 0) - (pressedKeys.has('e') ? 1 : 0);
  state.targetYaw += (keyboardLook + joystickInput.lookX) * LOOK_SPEED * delta;
  state.targetPitch = THREE.MathUtils.clamp(state.targetPitch + joystickInput.lookY * LOOK_SPEED * 0.75 * delta, -MAX_PITCH, MAX_PITCH);
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
    info.innerHTML = `<h3>人物信息</h3><p>${data.spec.height} cm · 相机正交纸片人</p><p>当前显示：${state.secondStandees ? '第二阶段立绘' : '基础立绘'}</p><label>互动方式<textarea id="drawerInteractionMethod" maxlength="800" placeholder="描述想与她进行的互动"></textarea></label>`;
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
  if (sceneInputBlocked() || Math.abs(event.deltaY) < 1) return;
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
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
    thumb.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    if (kind === 'move') { joystickInput.moveX = dx / radius; joystickInput.moveY = -dy / radius; }
    else { joystickInput.lookX = dx / radius; joystickInput.lookY = -dy / radius; }
  }

  node.addEventListener('pointerdown', event => {
    pointerId = event.pointerId;
    node.setPointerCapture?.(pointerId);
    update(event);
  });
  node.addEventListener('pointermove', update);
  node.addEventListener('pointerup', reset);
  node.addEventListener('pointercancel', reset);
  node.addEventListener('lostpointercapture', reset);
}

function onScenePointer(event) {
  if (event.pointerType === 'touch') return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactives, false).find(entry => entry.object.visible !== false);
  if (!hit?.object?.userData?.kind) return;
  const worldPosition = new THREE.Vector3();
  hit.object.getWorldPosition(worldPosition);
  worldPosition.y = camera.position.y;
  if (worldPosition.distanceTo(camera.position) > INTERACTION_RANGE) {
    showToast('再靠近一点才能互动');
    return;
  }
  openDialog(hit.object.userData);
}

function dispatch(action) {
  if (EMBEDDED) {
    const hostAction = {
      'open-rules': 'rules', 'open-items': 'items', 'open-character-list': 'party',
      'open-decree': 'decree', 'open-actions': 'actions', 'daily': 'daily',
      'switch-simple': 'switch-simple',
    }[action];
    if (hostAction) { postHostIntent(hostAction); return; }
    if (action === 'toggle-standees') return;
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
  } else if (action === 'toggle-standees') {
    state.secondStandees = !state.secondStandees;
    billboards.forEach(mesh => {
      const index = mesh.userData.characterIndex;
      applyCharacterTexture(mesh, index, state.secondStandees);
    });
    const label = root.querySelector('[data-kg-action="toggle-standees"] small');
    if (label) label.textContent = state.secondStandees ? '基础立绘' : '阶段立绘';
    renderParty();
    showToast(state.secondStandees ? '已切换至第二立绘' : '已切换至基础立绘');
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

function controlKey(event) {
  const key = String(event.key || '').toLowerCase();
  return ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown'].includes(key) ? key : '';
}

window.addEventListener('keydown', event => {
  const key = controlKey(event);
  if (!key || event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
  pressedKeys.add(key);
  event.preventDefault();
});
window.addEventListener('keyup', event => {
  const key = controlKey(event);
  if (!key) return;
  pressedKeys.delete(key);
  event.preventDefault();
});
window.addEventListener('blur', () => pressedKeys.clear());

renderer.domElement.addEventListener('pointerup', onScenePointer);
renderer.domElement.addEventListener('wheel', onSceneWheel, { passive: false });
root.querySelectorAll('.joystick').forEach(bindJoystick);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (dialogLayer.getAttribute('aria-hidden') === 'false' || leftDrawer.getAttribute('aria-hidden') === 'false')) {
    closeDialog(false);
    closeLeftDrawer(false);
    drawerScrim.classList.remove('is-open');
    drawerScrim.setAttribute('aria-hidden', 'true');
  }
});

function renderParty() {
  partyList.innerHTML = characterSpecs.map(spec => `
    <button type="button" class="party-card" data-kg-action="open-character" data-character-id="${spec.id}">
      <img src="${state.secondStandees ? spec.secondImage : spec.image}" alt="${spec.name}纸片人缩略图">
      <div><strong>${spec.name}${spec.role ? ` · ${spec.role}` : ''}</strong><small>${spec.height} cm · orthographic sprite</small></div>
      <em style="color:${spec.color}">●</em>
    </button>
  `).join('');
}

function updateMiniMap() {
  const width = miniMap.width;
  const height = miniMap.height;
  mapContext.clearRect(0, 0, width, height);
  mapContext.fillStyle = 'rgba(7,8,10,.92)';
  mapContext.fillRect(0, 0, width, height);
  const padding = 22;
  const worldSize = state.zone === 'hall' ? HALL_SIZE : ROOM_SIZE;
  const scale = (width - padding * 2) / worldSize;
  const project = (x, z) => [width / 2 + x * scale, height / 2 + z * scale];
  mapContext.strokeStyle = '#826d3f';
  mapContext.lineWidth = 3;
  mapContext.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
  if (state.zone === 'hall') {
    const [cx, cy] = project(0, 0);
    mapContext.fillStyle = 'rgba(207,174,95,.22)';
    mapContext.beginPath();
    mapContext.arc(cx, cy, TABLE_RADIUS * scale, 0, Math.PI * 2);
    mapContext.fill();
    characterSpecs.forEach(spec => {
      if (EMBEDDED && hostSnapshot) {
        const location = String(hostSnapshot.角色?.[spec.name]?.地点 || '');
        if (location && !location.includes('大厅')) return;
      }
      const [x, y] = project(spec.position[0], spec.position[1]);
      mapContext.fillStyle = spec.color;
      mapContext.beginPath();
      mapContext.arc(x, y, 5, 0, Math.PI * 2);
      mapContext.fill();
    });
  } else {
    mapContext.strokeStyle = '#8e8a7d';
    mapContext.strokeRect(padding + 4, padding + 4, 66, 66);
    mapContext.fillStyle = 'rgba(207,174,95,.28)';
    mapContext.fillRect(width - padding - 28, padding + 2, 24, 9);
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
}

new ResizeObserver(resize).observe(viewport);
window.addEventListener('resize', resize);

let previousTime = performance.now();
function animate(time) {
  const delta = Math.min(0.05, (time - previousTime) / 1000);
  previousTime = time;
  if (EMBEDDED && !hostActive) { requestAnimationFrame(animate); return; }
  applyContinuousControls(delta);
  const positionBlend = 1 - Math.exp(-delta * 12);
  state.position.lerp(state.targetPosition, positionBlend);
  let yawDifference = ((state.targetYaw - state.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (yawDifference < -Math.PI) yawDifference += Math.PI * 2;
  state.yaw += yawDifference * positionBlend;
  state.pitch += (state.targetPitch - state.pitch) * positionBlend;
  camera.position.copy(state.position);
  camera.rotation.set(state.pitch, state.yaw, 0);
  billboards.forEach(mesh => mesh.lookAt(camera.position.x, mesh.position.y, camera.position.z));
  interactiveHighlights.forEach((helper, object) => {
    const worldPosition = new THREE.Vector3();
    object.getWorldPosition(worldPosition);
    worldPosition.y = camera.position.y;
    helper.visible = object.visible !== false && worldPosition.distanceTo(camera.position) <= INTERACTION_RANGE;
    if (helper.visible) helper.update();
  });
  updateMiniMap();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

renderParty();
setZone('hall');
if (EMBEDDED) {
  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'king-game-3d:snapshot') applyHostSnapshot(event.data.state);
    else if (event.data?.type === 'king-game-3d:overlay') {
      hostOverlayBlocked = event.data.blocked === true;
      if (hostOverlayBlocked) pressedKeys.clear();
    } else if (event.data?.type === 'king-game-3d:active') {
      hostActive = event.data.active === true;
      if (!hostActive) pressedKeys.clear();
    }
  });
  window.parent.postMessage({ type: 'king-game-3d:ready' }, '*');
}
resize();
loadingState.classList.add('is-hidden');
setTimeout(() => loadingState.remove(), 420);
viewport.focus();
requestAnimationFrame(animate);
