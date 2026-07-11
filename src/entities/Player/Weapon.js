import * as THREE from 'three'
import Component from '../../Component'
import Input from '../../Input'
import {Ammo, AmmoHelper, CollisionFilterGroups} from '../../AmmoLib'

import WeaponFSM from './WeaponFSM';


export default class Weapon extends Component{
    constructor(camera, model, flash, world, shotSoundBuffer, listner){
        super();
        this.name = 'Weapon';
        this.camera = camera;
        this.world = world;
        this.model = model;
        this.flash = flash;
        this.animations = {};
        this.shoot = false;
        this.shootTimer = 0.0;

        this.shotSoundBuffer = shotSoundBuffer;
        this.audioListner = listner;
        this.reloading = false;
        this.hitResult = {intersectionPoint: new THREE.Vector3(), intersectionNormal: new THREE.Vector3()};

        this.currentWeaponIndex = 0;
        this.weapons = [
            {
                name: 'AK47',
                model: this.model,
                fireRate: 0.1,
                magAmmo: 30,
                ammoPerMag: 30,
                ammo: 90,
                damage: 20,
                maxAmmo: 180,
            }
        ];
    }

    get activeWeapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    SetAnim(name, clip){
        const action = this.mixer.clipAction(clip);
        this.animations[name] = {clip, action};
    }

    SetAnimations(){
        this.mixer = new THREE.AnimationMixer( this.model );
        this.SetAnim('idle', this.model.animations[1]);
        this.SetAnim('reload', this.model.animations[2]);
        this.SetAnim('shoot', this.model.animations[0]);
    }

    SetMuzzleFlash(){
        this.flash.position.set(-0.3, -0.5, 8.3);
        this.flash.rotateY(Math.PI);
        this.model.add(this.flash);
        this.flash.life = 0.0;

        this.flash.children[0].material.blending = THREE.AdditiveBlending;
    }

    SetSoundEffect(){
        this.shotSound = new THREE.Audio(this.audioListner);
        this.shotSound.setBuffer(this.shotSoundBuffer);
        this.shotSound.setLoop(false);

        this.pistolSound = new THREE.Audio(this.audioListner);
        this.pistolSound.setBuffer(this.shotSoundBuffer);
        this.pistolSound.setLoop(false);
        this.pistolSound.setPlaybackRate(1.3); // Handgun pitch
        this.pistolSound.setVolume(0.7);
    }

    AmmoPickup = (e) => {
        this.weapons[0].ammo = Math.min(this.weapons[0].maxAmmo, this.weapons[0].ammo + 30);
        this.weapons[1].ammo = Math.min(this.weapons[1].maxAmmo, this.weapons[1].ammo + 7);
        this.uimanager.SetAmmo(this.activeWeapon.magAmmo, this.activeWeapon.ammo);
    }

    CreateM1911Pistol(){
        const group = new THREE.Group();
        
        // Grip/Handle
        const gripGeom = new THREE.BoxGeometry(0.035, 0.12, 0.045);
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.9 }); // brown wood look
        const grip = new THREE.Mesh(gripGeom, gripMat);
        grip.position.set(0, -0.06, 0.02);
        grip.rotation.x = -Math.PI / 8;
        group.add(grip);
        
        // Frame/Body
        const frameGeom = new THREE.BoxGeometry(0.038, 0.035, 0.14);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f2124, metalness: 0.8, roughness: 0.4 });
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.set(0, -0.01, -0.01);
        group.add(frame);
        
        // Slide (Ferrolho)
        const slideGeom = new THREE.BoxGeometry(0.04, 0.04, 0.20);
        const slideMat = new THREE.MeshStandardMaterial({ color: 0x282b30, metalness: 0.85, roughness: 0.3 });
        this.pistolSlide = new THREE.Mesh(slideGeom, slideMat);
        this.pistolSlide.position.set(0, 0.02, -0.04);
        group.add(this.pistolSlide);
        
        // Barrel Tip (Cano)
        const barrelGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.95, roughness: 0.15 });
        const barrel = new THREE.Mesh(barrelGeom, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -0.08); 
        this.pistolSlide.add(barrel);
        
        // Trigger Guard
        const guardGeom = new THREE.BoxGeometry(0.008, 0.035, 0.045);
        const guardMat = new THREE.MeshStandardMaterial({ color: 0x1f2124, metalness: 0.8 });
        const guard = new THREE.Mesh(guardGeom, guardMat);
        guard.position.set(0, -0.035, -0.03);
        group.add(guard);
        
        // Trigger
        const triggerGeom = new THREE.BoxGeometry(0.006, 0.015, 0.01);
        const triggerMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9 });
        const trigger = new THREE.Mesh(triggerGeom, triggerMat);
        trigger.position.set(0, -0.03, -0.025);
        group.add(trigger);
        
        // Front sight
        const frontSightGeom = new THREE.BoxGeometry(0.006, 0.008, 0.01);
        const frontSight = new THREE.Mesh(frontSightGeom, slideMat);
        frontSight.position.set(0, 0.022, -0.09);
        this.pistolSlide.add(frontSight);
        
        // Rear sight
        const rearSightGeom = new THREE.BoxGeometry(0.01, 0.008, 0.008);
        const rearSight = new THREE.Mesh(rearSightGeom, slideMat);
        rearSight.position.set(0, 0.022, 0.09);
        this.pistolSlide.add(rearSight);

        group.position.set(0.1, -0.15, -0.3);
        
        return group;
    }

    Initialize(){
        const scene = this.model;
        scene.scale.set(0.05, 0.05, 0.05);
        scene.position.set(0.04, -0.02, 0.0);
        scene.setRotationFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(5), THREE.MathUtils.degToRad(185), 0));

        scene.traverse(child=>{
            if(!child.isSkinnedMesh){
                return;
            }

            child.receiveShadow = true;
        });

        this.camera.add(scene);

        this.SetAnimations();
        this.SetMuzzleFlash();
        this.SetSoundEffect();

        // Create weapons array (AK47 and M1911)
        this.weapons = [
            {
                name: 'AK47',
                model: this.model,
                fireRate: 0.1,
                magAmmo: 30,
                ammoPerMag: 30,
                ammo: 90,
                damage: 20,
                maxAmmo: 180,
            },
            {
                name: 'Colt M1911',
                model: this.CreateM1911Pistol(),
                fireRate: 0.25,
                magAmmo: 7,
                ammoPerMag: 7,
                ammo: 21,
                damage: 35,
                maxAmmo: 42,
            }
        ];
        this.currentWeaponIndex = 0;

        this.stateMachine = new WeaponFSM(this);
        this.stateMachine.SetState('idle');

        this.uimanager = this.FindEntity("UIManager").GetComponent("UIManager");
        this.uimanager.SetAmmo(this.activeWeapon.magAmmo, this.activeWeapon.ammo);

        this.SetupInput();

        //Listen to ammo pickup event
        this.parent.RegisterEventHandler(this.AmmoPickup, "AmmoPickup");
    }

    SetupInput(){
        Input.AddMouseDownListner( e => {
            if(e.button != 0 || this.reloading){
                return;
            }

            this.shoot = true;
            this.shootTimer = 0.0;
        });

        Input.AddMouseUpListner( e => {
            if(e.button != 0){
                return;
            }

            this.shoot = false;
        });

        Input.AddKeyDownListner(e => {
            if(e.repeat) return;

            if(e.code == "KeyR"){
                this.Reload();
            }
            if(e.code == "Digit1"){
                this.SwitchWeapon(0);
            }
            if(e.code == "Digit2"){
                this.SwitchWeapon(1);
            }
        });
    }

    SwitchWeapon(index){
        if (index === this.currentWeaponIndex || this.reloading || this.shoot) {
            return;
        }

        console.log(`[Weapon] Switching to weapon ${index} (${this.weapons[index].name})`);

        // Hide current weapon model
        const currentWeapon = this.weapons[this.currentWeaponIndex];
        this.camera.remove(currentWeapon.model);

        // Show new weapon model
        this.currentWeaponIndex = index;
        const newWeapon = this.weapons[this.currentWeaponIndex];
        this.camera.add(newWeapon.model);

        // Update HUD
        this.uimanager.SetAmmo(newWeapon.magAmmo, newWeapon.ammo);

        // Reset state machine
        this.stateMachine.SetState('idle');
    }

    Reload(){
        if(this.reloading || this.activeWeapon.magAmmo == this.activeWeapon.ammoPerMag || this.activeWeapon.ammo == 0){
            return;
        }

        this.reloading = true;
        this.stateMachine.SetState('reload');
    }

    ReloadDone(){
        this.reloading = false;
        const bulletsNeeded = this.activeWeapon.ammoPerMag - this.activeWeapon.magAmmo;
        this.activeWeapon.magAmmo = Math.min(this.activeWeapon.ammo + this.activeWeapon.magAmmo, this.activeWeapon.ammoPerMag);
        this.activeWeapon.ammo = Math.max(0, this.activeWeapon.ammo - bulletsNeeded);
        this.uimanager.SetAmmo(this.activeWeapon.magAmmo, this.activeWeapon.ammo);
    }

    Raycast(){
        const start = new THREE.Vector3(0.0, 0.0, -1.0);
        start.unproject(this.camera);
        const end = new THREE.Vector3(0.0, 0.0, 1.0);
        end.unproject(this.camera);

        const collisionMask = CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;
        
        if(AmmoHelper.CastRay(this.world, start, end, this.hitResult, collisionMask)){
            const ghostBody = Ammo.castObject( this.hitResult.collisionObject, Ammo.btPairCachingGhostObject );
            const rigidBody = Ammo.castObject( this.hitResult.collisionObject, Ammo.btRigidBody ); 
            const entity = ghostBody.parentEntity || rigidBody.parentEntity;
            
            entity && entity.Broadcast({'topic': 'hit', from: this.parent, amount: this.activeWeapon.damage, hitResult: this.hitResult});
        }
    }

    Shoot(t){
        if(!this.shoot){
            return;
        }

        if(!this.activeWeapon.magAmmo){
            this.Reload();
            return;
        }

        if(this.shootTimer <= 0.0 ){
            if (this.currentWeaponIndex === 0) {
                this.flash.life = this.activeWeapon.fireRate;
                this.flash.rotateZ(Math.PI * Math.random());
                const scale = Math.random() * (1.5 - 0.8) + 0.8;
                this.flash.scale.set(scale, 1, 1);
            } else if (this.currentWeaponIndex === 1) {
                this.activeWeapon.model.add(this.flash);
                this.flash.position.set(0, 0.022, -0.12);
                const scale = Math.random() * (0.6 - 0.3) + 0.3;
                this.flash.scale.set(scale, scale, scale);
                this.flash.life = this.activeWeapon.fireRate;
            }
            this.shootTimer = this.activeWeapon.fireRate;
            this.activeWeapon.magAmmo = Math.max(0, this.activeWeapon.magAmmo - 1);
            this.uimanager.SetAmmo(this.activeWeapon.magAmmo, this.activeWeapon.ammo);

            this.Raycast();
            this.Broadcast({topic: 'ak47_shot'});
            
            if (this.currentWeaponIndex === 0) {
                this.shotSound.isPlaying && this.shotSound.stop();
                this.shotSound.play();
            } else {
                this.pistolSound.isPlaying && this.pistolSound.stop();
                this.pistolSound.play();
            }
        }

        this.shootTimer = Math.max(0.0, this.shootTimer - t);
    }

    AnimateMuzzle(t){
        if (this.currentWeaponIndex !== 0 && this.flash.life <= 0) return;
        const mat = this.flash.children[0].material;
        const ratio = this.flash.life / this.activeWeapon.fireRate;
        mat.opacity = ratio;
        this.flash.life = Math.max(0.0, this.flash.life - t);
    }

    Update(t){
        if (this.currentWeaponIndex === 0 && this.mixer) {
            this.mixer.update(t);
        }
        this.stateMachine.Update(t);
        this.Shoot(t);
        this.AnimateMuzzle(t);
    }

}