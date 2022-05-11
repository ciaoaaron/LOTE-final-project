import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';




class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};

class PlayerControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};

class Health {
  constructor(params) {
    this._healthClassName = params.className;
    this._healthPoint = 100;
    if (params.fsm) {
      this._fsm = params.fsm;
    }
  }
  get healthBar() {
    return document.querySelector(`.${this._healthClassName} .health`);
  }

  deduct(damage) {
    this._healthPoint -= damage;
    const barWidth = this._healthPoint < 0 ? 0 : this._healthPoint;
    this.healthBar.setAttribute('style', `width: ${barWidth}%`);
  }
}

class PlayerController {
  constructor(params) {
    const { scene } = params;
    this._scene = scene;
    this._opponent = undefined;
    this._health = new Health({ className: 'player' });
    this._dizzyLevel = 0;
    this._animations = {
      'slash': {
        action: function() {
          this._opponent._health.deduct(20);
          this._opponent._stateMachine.SetState('react');
          this.setEffect('slash');
        }.bind(this)
      },
      'chop': {
        action: function() {
          this._opponent._health.deduct(10);
          this._opponent._stateMachine.SetState('react');
          this.setEffect('chop');
        }.bind(this)
      },
      'upper_slash': {
        action: function() {
          this._opponent._health.deduct(5);
          this._opponent._stateMachine.SetState('react');
          this.setEffect('upper_slash');
        }.bind(this)
      },
      'guard': {
        action: function() {
          this.playSound('block');
        }.bind(this)
      }
    };
    this._input = new PlayerControllerInput();
    this._stateMachine = new PlayerFSM(new PlayerControllerProxy(this._animations));

    this._stateMachine.SetState('idle');
    this._swordEffects = [];    
  }

  attack({ type }) {
    const TYPES = ['slash', 'chop', 'upper_slash'];
    if (!TYPES.includes(type)) return;
    if (this._input._keys[type]) {
      this._stateMachine.SetState(type);
      this._input.resetStates();
    }
  }

  playSound(sound) {
    const path = './resources/sound/';
    const event = new CustomEvent('playSound', { detail: { sound: `${path}/${sound}.mp3`}});
    console.log(`playSound dispatched for ${sound}.`)
    window.dispatchEvent(event);
  }

  setEffect(effect) {
    const img = document.createElement('img');
    img.addEventListener('transitionend', () => {
      img.remove();
      this._swordEffects.shift();
    })
    this.playSound('slash');
    img.setAttribute('src', `./resources/player/${effect}.png`);
    document.body.appendChild(img);
    
    this._swordEffects.push([img, new Date().getTime() / 1000]);
  }

  addOpponent(opponent) {
    this._opponent = opponent;
  }

  addBLE({ ble, charCharacteristic }) {
    if (this._ble) return;
    this._ble = ble;
    this._input.addBLE({ ble, charCharacteristic });
  }

  Update(timeInSeconds) {
    this._stateMachine.Update(timeInSeconds, this._input);

    this._swordEffects.forEach(e => {
      if (new Date().getTime() / 1000 - e[1] > 0.5) {
        e[0].classList.add('fadeOut');
      }
    });
    if (this._input._keys.slash) {
      this.attack({ type: 'slash'});
    }
    if (this._input._keys.chop) {
      this.attack({ type: 'chop'});
    }
    if (this._input._keys['upper_slash']) {
      this.attack({ type: 'upper_slash'});
    }

    this._dizzyLevel = Math.abs(this._health._healthPoint - 100) * 0.05;
  }
}

class BasicCharacterController {
  constructor(params) {
    this._Init(params);
    this._opponent =  params.opponent;
    this._punchTimeStamp = 0;
    this._health = new Health({ className: 'freak', fsm: this._stateMachine });
    this._didGuard = false;
  }

  _Init(params) {
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
    this._velocity = new THREE.Vector3(0, 0, 0);

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this._LoadModels();
  }

  _LoadModels() {
    const loader = new FBXLoader();
    loader.setPath('./resources/paladin/');
    loader.load('character.fbx', (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });

      this._target = fbx;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(this._manager);
      loader.setPath('./resources/paladin/');
      loader.load('idle.fbx', (a) => { _OnLoad('idle', a); });
      loader.load('punch.fbx', (a) => { _OnLoad('punch', a); });
      loader.load('death.fbx', (a) => { _OnLoad('death', a); });
      loader.load('victory.fbx', (a) => { _OnLoad('victory', a); });
      loader.load('react.fbx', (a) => { _OnLoad('react', a); });
    });
  }

  roundTo1Decimal(num) {
    return Math.round(num * 10) / 10;
  }

  Update(timeInSeconds) {
    if (!this._target) {
      return;
    }

    this._stateMachine.Update(timeInSeconds, this._input);

    if (this._stateMachine._currentState.Name == 'punch') {
      this._punchTimeStamp += timeInSeconds;
      const currentTime = this.roundTo1Decimal(this._punchTimeStamp);
      const totalTime = this.roundTo1Decimal(this._animations['punch'].clip.duration);

      if (!this._opponent._input._keys.guard) {
        if (currentTime > totalTime * 0.5 && currentTime < totalTime * 0.55) {
          if (!this._stateMachine._currentState.didHandle) {
            this._stateMachine._currentState.didHandle = true;
            this._opponent._health.deduct(20);
          }
        }
      } else {
        if (!this._didGuard && currentTime > totalTime * 0.3 && currentTime < totalTime * 0.35) {
          this._opponent._stateMachine.SetState('guard');
          this._didGuard = true;
        }
      };
      
      if (this._health._healthPoint <= 0) {
        matchStarted = false;
      }

      if (this._opponent._health._healthPoint <= 0) {
        matchStarted = false;
      }
      
      if (currentTime === totalTime) {
        this._punchTimeStamp = 0;
      }
    } else {
      this._didGuard = false;
    }
    
    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};


class PlayerControllerInput {
  constructor() {
    this.currentState;
    this._Init();
  }

  _Init() {
    this._keys = {
      chop: false,
      slash: false,
      guard: false,
      idle: false,
      'upper_slash': false,
    };
    this._states = ['chop', 'slash', 'guard', 'upper_slash', 'idle'];
  //document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
    console.log('[from controller]', charCharacteristic)
  }

  addBLE({ ble, charCharacteristic }) {
    ble.startNotifications(charCharacteristic, debounce(this.handleNotifications.bind(this), 350));
  }

  resetStates() {
    Object.keys(this._keys).forEach(key => {
      this._keys[key] = false;
    });
  }

  handleNotifications(data) {
    const state = this._states[data] || 'idle';
    
    this.resetStates();
    this._keys[state] = true;

    console.log('handleNotifications', state, this.currentState, this._keys)
  }
};

class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      punch: false,
      vistory: false,
      death: false,
      react: false,
    };
  }
};


class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('punch', PunchState);
    this._AddState('death', DeathState);
    this._AddState('victory', VictoryState);
    this._AddState('react', ReactState);
  }
};

class PlayerFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', PlayerIdleState);
    this._AddState('slash', SlashState);
    this._AddState('chop', ChopState);
    this._AddState('upper_slash', UpperSlashState);
    this._AddState('guard', GuardState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
    console.log('[State]', this);
  }

  Enter() {}
  Exit() {}
  Update() {}
};

class PunchState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }

    this.didHandle = false;
  }

  get Name() {
    return 'punch';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations[this.Name].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();  
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }

    playSound('./resources/sound/slash.mp3')
  }

  _Finished() {
    this._Cleanup();
    this._parent.SetState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations[this.Name].action;
    
    action.getMixer().removeEventListener('finished', this._FinishedCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(_) {
  }

}

class SlashState extends State {
  constructor(parent) {
    super(parent);
    this.didHandle = false;
  }
  get Name() {
    return 'slash';
  }

  Update() {
    this._update();
  }

  _update() {
    if (this.didHandle) {
      this._parent.SetState('idle');
    } else {
      this.didHandle = true;
      this.Play();
    }
  }

  Play() {
    this._parent._proxy._animations[this.Name].action();
  }
}

class ChopState extends SlashState {
  get Name() {
    return 'chop';
  }
}

class UpperSlashState extends SlashState {
  get Name() {
    return 'upper_slash';
  }
}

class GuardState extends State {
  constructor(parent) {
    super(parent)
    this._oldTimeStamp = 0;
  }
  get Name() {
    return 'guard';
  }

  Enter(prevState) {
    if (prevState.NAME == this.NAME) {
      this._parent.SetState('idle');
    }
    const action = this._parent._proxy._animations[this.Name].action;

    action.call();
  }
};

class DeathState extends PunchState {
  get Name() {
    return 'death';
  }

  _Finished() {
    this._Cleanup();
  }
}

class VictoryState extends DeathState {
  get Name() {
    return 'victory';
  }
}

class ReactState extends PunchState {
  get Name() {
    return 'react';
  }
  Enter(prevState) {
    const action = this._parent._proxy._animations['react'].action;
    const mixer = action.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      action.reset();  
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.crossFadeFrom(prevAction, 0.2, true);
      action.play();
    }
  }
}

class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      console.log('Crossing Fading Idle State')
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      console.log('[prevAction]', prevAction)
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  rollDice() {
    return Math.ceil(Math.random()*6);
  }

  shouldAttack () {
    if (!matchStarted) return;
    let n =  [undefined, undefined, undefined].map((v) => {
      if (!v) {
        return this.rollDice();
      }
    }).join('');
    return n === '222';
  }

  Update(_) {
    if (this.shouldAttack()) {
      this._parent.SetState('punch');
    }
  }
};

class PlayerIdleState extends IdleState {
  constructor(parent) {
    super(parent);
  }

  Enter() {};

  Update() {};
}


class CharacterControllerDemo {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 500.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(0,15, 15);

    this._scene = new THREE.Scene();

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this._scene.add(light);

    const controls = new OrbitControls(
      this._camera, this._threejs.domElement);
    controls.target.set(0, 15, 0);
    controls.update();

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/posx.jpg',
        './resources/negx.jpg',
        './resources/posy.jpg',
        './resources/negy.jpg',
        './resources/posz.jpg',
        './resources/negz.jpg',
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this._scene.background = texture;

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 10, 10),
        new THREE.MeshStandardMaterial({
            color: 0x808080,
          }));
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this._scene.add(plane);

    this._mixers = [];
    this._previousRAF = null;
    this._player = new PlayerController({ scene: this._scene });
    this._LoadAnimatedModel();
    this._RAF();
  }

  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
      opponent: this._player,
    }
    this._controls = new BasicCharacterController(params);
    this._player.addOpponent(this._controls);
  }

  _LoadAnimatedModelAndPlay(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      fbx.position.copy(offset);

      const anim = new FBXLoader();
      anim.setPath(path);
      anim.load(animFile, (anim) => {
        const m = new THREE.AnimationMixer(fbx);
        this._mixers.push(m);
        const idle = m.clipAction(anim.animations[0]);
        idle.play();
      });
      this._scene.add(fbx);
    });
  }

  _LoadModel() {
    const loader = new GLTFLoader();
    loader.load('./resources/thing.glb', (gltf) => {
      gltf.scene.traverse(c => {
        c.castShadow = true;
      });
      this._scene.add(gltf.scene);
    });
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
      if (!this._ble && ble && charCharacteristic) {
        this._ble = ble;
        this._player.addBLE({ ble, charCharacteristic });
      }
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }
    if (this._player) {
      this._player.Update(timeElapsedS);

      if (this._player._dizzyLevel) {
        this._threejs.domElement.setAttribute('style', `filter: blur(${this._player._dizzyLevel}px) grayscale(${this._player._dizzyLevel / 0.05}%)`)
      }
    }

    if (this._player && this._controls) {
      if (this._controls._health._healthPoint <= 0) {
        this._controls._stateMachine.SetState('death');
      }

      if (this._player._health._healthPoint <= 0) {
        this._controls._stateMachine.SetState('victory');
      }
    }
  }
}

function debounce(callback, timeout = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => { callback.apply(this, args) }, timeout);
  }
}

function playSound(path) {
  const audio = new Audio(path);
  audio.play();
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new CharacterControllerDemo();
});

window.addEventListener('playSound', (e) => {
  console.log('playSound fired')
  if (!e.detail.sound) return;
  playSound(e.detail.sound);
})

