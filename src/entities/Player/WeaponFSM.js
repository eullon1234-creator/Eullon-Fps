import {FiniteStateMachine, State} from '../../FiniteStateMachine'
import * as THREE from 'three'

export default class WeaponFSM extends FiniteStateMachine{
    constructor(proxy){
        super();
        this.proxy = proxy;
        this.Init();
    }

    Init(){
        this.AddState('idle', new IdleState(this));
        this.AddState('shoot', new ShootState(this));
        this.AddState('reload', new ReloadState(this));
    }
}

class IdleState extends State{
    constructor(parent){
        super(parent);
    }

    get Name(){return 'idle'}
    get Animation(){return this.parent.proxy.animations['idle']; }

    Enter(prevState){
        if (this.parent.proxy.currentWeaponIndex === 0) {
            const action = this.Animation.action;

            if(prevState){
                action.time = 0.0;
                action.enabled = true;
                action.setEffectiveTimeScale(1.0);
                action.crossFadeFrom(prevState.Animation.action, 0.1, true);
            }

            action.play();
        } else {
            // Reset position/recoil for Plasma Pistol model
            const model = this.parent.proxy.activeWeapon.model;
            if (model) {
                model.position.set(0.1, -0.15, -0.3);
            }
        }
    }

    Update(t){
        if(this.parent.proxy.shoot && this.parent.proxy.activeWeapon.magAmmo > 0){
            this.parent.SetState('shoot');
        }
    }
}

class ShootState extends State{
    constructor(parent){
        super(parent);
    }

    get Name(){return 'shoot'}
    get Animation(){return this.parent.proxy.animations['shoot']; }

    Enter(prevState){
        if (this.parent.proxy.currentWeaponIndex === 0) {
            const action = this.Animation.action;

            if(prevState){
                action.time = 0.0;
                action.enabled = true;
                action.setEffectiveTimeScale(1.0);
                action.crossFadeFrom(prevState.Animation.action, 0.1, true);
            }

            action.timeScale = 3.0;
            action.play();
        } else {
            // Procedural recoil kickback and muzzle climb for M1911!
            const model = this.parent.proxy.activeWeapon.model;
            if (model) {
                model.position.z = -0.25; // Kickback gun backwards
                model.rotation.x = -0.15; // Kick muzzle upwards
            }
            // Slide blowback: slide slides backwards
            const slide = this.parent.proxy.pistolSlide;
            if (slide) {
                slide.position.z = 0.00; // moves back (rest is -0.04)
            }
        }
    }

    Update(t){
        if (this.parent.proxy.currentWeaponIndex !== 0) {
            // Smoothly return gun model from recoil
            const model = this.parent.proxy.activeWeapon.model;
            if (model) {
                model.position.z = THREE.MathUtils.lerp(model.position.z, -0.3, 15 * t);
                model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, 0, 15 * t);
            }
            // Smoothly return slide forward
            const slide = this.parent.proxy.pistolSlide;
            if (slide) {
                slide.position.z = THREE.MathUtils.lerp(slide.position.z, -0.04, 25 * t);
            }
        }

        if(!this.parent.proxy.shoot || this.parent.proxy.activeWeapon.magAmmo == 0){
            this.parent.SetState('idle');
        }
    }
}

class ReloadState extends State{
    constructor(parent){
        super(parent);

        this.parent.proxy.mixer.addEventListener( 'finished', this.AnimationFinished);
    }

    get Name(){ return 'reload'; }
    get Animation(){ return this.parent.proxy.animations['reload']; }

    AnimationFinished = e => {
        if(this.parent.proxy.currentWeaponIndex === 0 && e.action == this.Animation.action){
            this.parent.proxy.ReloadDone();
            this.parent.SetState('idle');
        }
    }

    Enter(prevState){
        if (this.parent.proxy.currentWeaponIndex === 0) {
            const action = this.Animation.action;
            action.loop = THREE.LoopOnce;

            if(prevState){
                action.time = 0.0;
                action.enabled = true;
                action.setEffectiveTimeScale(1.0);
                action.crossFadeFrom(prevState.Animation.action, 0.1, true);
            }

            action.play();
        } else {
            this.reloadTimer = 1.5; // 1.5 seconds reload timer
        }
    }

    Update(t){
        if (this.parent.proxy.currentWeaponIndex !== 0) {
            this.reloadTimer -= t;

            // Procedural reload animation: move weapon down then up
            const model = this.parent.proxy.activeWeapon.model;
            if (model) {
                if (this.reloadTimer > 0.75) {
                    model.position.y = THREE.MathUtils.lerp(model.position.y, -0.4, 8 * t); // Move down
                } else {
                    model.position.y = THREE.MathUtils.lerp(model.position.y, -0.15, 8 * t); // Return up
                }
            }

            if (this.reloadTimer <= 0) {
                if (model) {
                    model.position.y = -0.15;
                }
                this.parent.proxy.ReloadDone();
                this.parent.SetState('idle');
            }
        }
    }
}
