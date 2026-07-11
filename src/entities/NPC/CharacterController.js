import * as THREE from 'three'
import Component from '../../Component'
import {Ammo, AmmoHelper, CollisionFilterGroups} from '../../AmmoLib'
import CharacterFSM from './CharacterFSM'

import DebugShapes from '../../DebugShapes'


export default class CharacterController extends Component{
    constructor(model, clips, scene, physicsWorld){
        super();
        this.name = 'CharacterController';
        this.physicsWorld = physicsWorld;
        this.scene = scene;
        this.mixer = null;
        this.clips = clips;
        this.animations = {};
        this.model = model;
        this.dir = new THREE.Vector3();
        this.forwardVec = new THREE.Vector3(0,0,1);
        this.pathDebug = new DebugShapes(scene);
        this.path = [];
        this.tempRot = new THREE.Quaternion();

        this.viewAngle = Math.cos(Math.PI / 4.0);
        this.maxViewDistance = 20.0 * 20.0;
        this.tempVec = new THREE.Vector3();
        this.attackDistance = 2.2;

        this.canMove = true;
        this.health = 100;

        this.dodgeTime = 0.0;
        this.dodgeDir = 0;
        this.dodgeCooldown = 0.0;
        this.speedMultiplier = 1.0;
    }

    SetAnim(name, clip){
        const action = this.mixer.clipAction(clip);
        this.animations[name] = {clip, action};
    }

    SetupAnimations(){
        Object.keys(this.clips).forEach(key=>{this.SetAnim(key, this.clips[key])});
    }

    Initialize(){
        this.stateMachine = new CharacterFSM(this);
        this.navmesh = this.FindEntity('Level').GetComponent('Navmesh');
        this.hitbox = this.GetComponent('AttackTrigger');
        this.player = this.FindEntity("Player");

        this.parent.RegisterEventHandler(this.TakeHit, 'hit');

        // Register gunshot hearing handler
        this.player.RegisterEventHandler(this.HearGunshot, 'ak47_shot');

        const scene = this.model;

        scene.scale.setScalar(0.01);
        scene.position.copy(this.parent.position);
        
        this.mixer = new THREE.AnimationMixer( scene );

        scene.traverse(child => {
            if ( !child.isSkinnedMesh  ) {
                return;
            }

            child.frustumCulled = false;
            child.castShadow = true;
            child.receiveShadow = true;
            this.skinnedmesh = child;
            this.rootBone = child.skeleton.bones.find(bone => bone.name == 'MutantHips');
            this.rootBone.refPos = this.rootBone.position.clone();
            this.lastPos = this.rootBone.position.clone();
        });

        this.SetupAnimations();

        this.scene.add(scene);
        this.stateMachine.SetState('idle');

        // Create health bar 3D sprite floating above head
        this.healthCanvas = document.createElement('canvas');
        this.healthCanvas.width = 128;
        this.healthCanvas.height = 16;
        this.healthTexture = new THREE.CanvasTexture(this.healthCanvas);
        const healthMaterial = new THREE.SpriteMaterial({ 
            map: this.healthTexture, 
            depthTest: true, 
            depthWrite: false 
        });
        this.healthSprite = new THREE.Sprite(healthMaterial);
        this.healthSprite.scale.set(1.2, 0.15, 1);
        this.scene.add(this.healthSprite);
        this.UpdateHealthBar();
    }

    UpdateDirection(){
        this.dir.copy(this.forwardVec);
        this.dir.applyQuaternion(this.parent.rotation);
    }

    CanSeeThePlayer(){
        const playerPos = this.player.Position.clone();
        const modelPos = this.model.position.clone();
        modelPos.y += 1.35;
        const charToPlayer = playerPos.sub(modelPos);

        if(playerPos.lengthSq() > this.maxViewDistance){
            return;
        }

        charToPlayer.normalize();
        const angle = charToPlayer.dot(this.dir);

        if(angle < this.viewAngle){
            return false;
        }

        const rayInfo = {};
        const collisionMask = CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;
        
        if(AmmoHelper.CastRay(this.physicsWorld, modelPos, this.player.Position, rayInfo, collisionMask)){
            const body = Ammo.castObject( rayInfo.collisionObject, Ammo.btRigidBody );

            if(body == this.player.GetComponent('PlayerPhysics').body){
                return true;
            }
        }

        return false;
    }

    NavigateToRandomPoint(){
        const node = this.navmesh.GetRandomNode(this.model.position, 50);
        this.path = this.navmesh.FindPath(this.model.position, node);
    }

    NavigateToPlayer(){
        this.tempVec.copy(this.player.Position);
        this.tempVec.y = 0.5;
        this.path = this.navmesh.FindPath(this.model.position, this.tempVec);

        /*
        if(this.path){
            this.pathDebug.Clear();
            for(const point of this.path){
                this.pathDebug.AddPoint(point, "blue");
            }
        }
        */
    }

    FacePlayer(t, rate = 3.0){
        this.tempVec.copy(this.player.Position).sub(this.model.position);
        this.tempVec.y = 0.0;
        this.tempVec.normalize();

        this.tempRot.setFromUnitVectors(this.forwardVec, this.tempVec);
        this.model.quaternion.rotateTowards(this.tempRot, rate * t);
    }

    get IsCloseToPlayer(){
        this.tempVec.copy(this.player.Position).sub(this.model.position);

        if(this.tempVec.lengthSq() <= this.attackDistance * this.attackDistance){
            return true;
        }

        return false;
    }

    get IsPlayerInHitbox(){
        return this.hitbox.overlapping;
    }

    HitPlayer(){
        this.player.Broadcast({topic: 'hit'});
    }

    TakeHit = msg => {
        this.health = Math.max(0, this.health - msg.amount);
        this.UpdateHealthBar();

        if(this.health == 0){
            this.stateMachine.SetState('dead');
            if (this.healthSprite) {
                this.scene.remove(this.healthSprite);
            }
        }else{
            const stateName = this.stateMachine.currentState.Name;
            if(stateName == 'idle' || stateName == 'patrol'){
                this.stateMachine.SetState('chase');
            }

            // 40% chance to dodge when hit, only if cooldown is finished
            if (this.dodgeCooldown <= 0 && Math.random() < 0.40 && (stateName === 'chase' || stateName === 'attack' || stateName === 'idle' || stateName === 'patrol')) {
                this.dodgeTime = 0.4; // Dodge slide duration (0.4s)
                this.dodgeDir = Math.random() < 0.5 ? 1 : -1;
                this.dodgeCooldown = 2.5; // Cooldown of 2.5 seconds before next dodge
            }
        }
    }

    UpdateHealthBar(){
        if (!this.healthCanvas) return;
        const ctx = this.healthCanvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 16);
        
        // Red background
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 128, 16);
        
        // Green foreground
        ctx.fillStyle = '#00ff00';
        const healthWidth = (this.health / 100) * 128;
        ctx.fillRect(0, 0, healthWidth, 16);
        
        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 128, 16);
        
        this.healthTexture.needsUpdate = true;
    }

    HearGunshot = (msg) => {
        if (this.health <= 0) return;
        const stateName = this.stateMachine.currentState.Name;
        if (stateName === 'idle' || stateName === 'patrol') {
            console.log(`[AI] ${this.parent.name} heard gunshot! Transitioning to chase.`);
            this.stateMachine.SetState('chase');
        }
    }

    MoveAlongPath(t){
        if(!this.path?.length) return;

        const target = this.path[0].clone().sub( this.model.position );
        target.y = 0.0;
       
        if (target.lengthSq() > 0.1 * 0.1) {
            target.normalize();
            this.tempRot.setFromUnitVectors(this.forwardVec, target);
            this.model.quaternion.slerp(this.tempRot,4.0 * t);
        } else {
            // Remove node from the path we calculated
            this.path.shift();

            if(this.path.length===0){
                this.Broadcast({topic: 'nav.end', agent: this});
            }
        }
    }

    ClearPath(){
        if(this.path){
            this.path.length = 0;
        }
    }

    ApplyRootMotion(){
        if(this.canMove){
            const vel = this.rootBone.position.clone();
            // Scale velocity by speedMultiplier to run faster
            vel.sub(this.lastPos).multiplyScalar(0.01 * (this.speedMultiplier || 1.0));
            vel.y = 0;

            vel.applyQuaternion(this.model.quaternion);

            const limit = 0.1 * (this.speedMultiplier || 1.0);
            if(vel.lengthSq() < limit * limit){
                this.model.position.add(vel);
            }
        }

        //Reset the root bone horizontal position
        this.lastPos.copy(this.rootBone.position);
        this.rootBone.position.z = this.rootBone.refPos.z;
        this.rootBone.position.x = this.rootBone.refPos.x;
    }

    Update(t){
        this.mixer && this.mixer.update(t);
        this.ApplyRootMotion();

        // Decrement dodge cooldown
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= t;
        }

        // Apply dodge movement (slower speed of 1.8 for smoother slide)
        if (this.dodgeTime > 0 && this.health > 0) {
            const dodgeSpeed = 1.8;
            const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(this.model.quaternion);
            this.model.position.addScaledVector(rightVec, this.dodgeDir * dodgeSpeed * t);
            this.dodgeTime -= t;
        }

        this.UpdateDirection();
        this.MoveAlongPath(t);
        this.stateMachine.Update(t);

        this.parent.SetRotation(this.model.quaternion);
        this.parent.SetPosition(this.model.position);

        // Update health sprite position
        if (this.health > 0 && this.healthSprite) {
            this.healthSprite.position.copy(this.model.position);
            this.healthSprite.position.y += 2.1;
        }
    }
}