import Component from '../../Component'
import * as THREE from 'three'
import {Ammo, createConvexHullShape} from '../../AmmoLib'

export default class LevelSetup extends Component{
    constructor(mesh, scene, physicsWorld, textures = null){
        super();
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.name = 'LevelSetup';
        this.mesh = mesh;
        this.extraGeometries = [];
        this.generators = [];
        this.extractionPad = null;
        this.textures = textures;
    }

    LoadScene(){
        
        this.mesh.traverse( ( node ) => {
            if ( node.isMesh || node.isLight ) { node.castShadow = true; }
            if(node.isMesh){ 
                node.receiveShadow = true; 
                //node.material.wireframe = true;
                this.SetStaticCollider(node, true);

                // Aplica a textura customizada se o nome contiver piso/floor/ground
                const nameLower = node.name.toLowerCase();
                if (this.textures && (nameLower.includes('floor') || nameLower.includes('ground') || nameLower.includes('piso') || nameLower.includes('terrain') || nameLower.includes('pavement') || nameLower.includes('concrete'))) {
                    // Configura o material com os mapas de textura PBR baixados
                    const mat = new THREE.MeshStandardMaterial({
                        map: this.textures.color.clone(),
                        normalMap: this.textures.normal.clone(),
                        roughnessMap: this.textures.roughness.clone(),
                        aoMap: this.textures.ao.clone(),
                        roughness: 1.0,
                        metalness: 0.2
                    });

                    // Aplica repetição (tiling) para não esticar
                    [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap].forEach(tex => {
                        if (tex) {
                            tex.wrapS = THREE.RepeatWrapping;
                            tex.wrapT = THREE.RepeatWrapping;
                            tex.repeat.set(10, 10);
                            tex.needsUpdate = true;
                        }
                    });

                    node.material = mat;
                }
            }

            if(node.isLight){
                node.intensity = 3;
                const shadow = node.shadow;
                const lightCam = shadow.camera;

                shadow.mapSize.width = 1024 * 3;
                shadow.mapSize.height = 1024 * 3;
                shadow.bias = -0.00007;

                const dH = 35, dV = 35;
                lightCam.left = -dH;
                lightCam.right = dH;
                lightCam.top = dV;
                lightCam.bottom = -dV;

                //const cameraHelper = new THREE.CameraHelper(lightCam);
                //this.scene.add(cameraHelper);
            }
        });

        this.scene.add( this.mesh );

        // Constroi a expansão do mapa
        this.BuildLevelExpansion();
    }

    CreateFloorMaterial(repeatX, repeatY) {
        if (!this.textures) {
            return new THREE.MeshStandardMaterial({
                color: 0x1b1d20,
                roughness: 0.7,
                metalness: 0.8
            });
        }
        
        const mat = new THREE.MeshStandardMaterial({
            map: this.textures.color.clone(),
            normalMap: this.textures.normal.clone(),
            roughnessMap: this.textures.roughness.clone(),
            aoMap: this.textures.ao.clone(),
            roughness: 1.0,
            metalness: 0.2
        });
        
        [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap].forEach(tex => {
            if (tex) {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(repeatX, repeatY);
                tex.needsUpdate = true;
            }
        });
        
        return mat;
    }

    BuildLevelExpansion(){
        const materialPonte = this.CreateFloorMaterial(2, 8);
        const materialSala = this.CreateFloorMaterial(6, 6);
        const materialPonteExtract = this.CreateFloorMaterial(2, 4);
        const materialSalaExtract = this.CreateFloorMaterial(4, 4);

        const materialWall = new THREE.MeshStandardMaterial({
            color: 0x111215,
            roughness: 0.9,
            metalness: 0.5
        });

        // 1. Ponte de Conexão (Liga a base original à Sala de Geradores)
        // O final da base original fica por volta de Z=35.
        this.CreatePlatform(new THREE.Vector3(32.77, 0, 48), new THREE.Vector3(6, 0.4, 28), materialPonte);

        // 2. Sala dos Geradores
        this.CreatePlatform(new THREE.Vector3(32.77, 0, 74), new THREE.Vector3(26, 0.4, 24), materialSala);

        // Paredes para a sala dos geradores (evitar que o jogador caia)
        // Parede Esquerda
        this.CreatePlatform(new THREE.Vector3(32.77 - 13, 1.5, 74), new THREE.Vector3(0.5, 3, 24), materialWall);
        // Parede Direita
        this.CreatePlatform(new THREE.Vector3(32.77 + 13, 1.5, 74), new THREE.Vector3(0.5, 3, 24), materialWall);
        // Parede Traseira Esquerda
        this.CreatePlatform(new THREE.Vector3(32.77 - 8, 1.5, 62), new THREE.Vector3(10, 3, 0.5), materialWall);
        // Parede Traseira Direita
        this.CreatePlatform(new THREE.Vector3(32.77 + 8, 1.5, 62), new THREE.Vector3(10, 3, 0.5), materialWall);

        // 3. Ponte de Extração
        this.CreatePlatform(new THREE.Vector3(32.77, 0, 94), new THREE.Vector3(6, 0.4, 16), materialPonteExtract);

        // 4. Plataforma de Extração Final
        this.extractionPad = this.CreatePlatform(new THREE.Vector3(32.77, 0, 108), new THREE.Vector3(12, 0.4, 12), materialSalaExtract);
        
        // Círculo luminoso na zona de extração
        const circleGeom = new THREE.RingGeometry(4, 4.3, 32);
        const circleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide });
        const extractionRing = new THREE.Mesh(circleGeom, circleMat);
        extractionRing.rotation.x = Math.PI / 2;
        extractionRing.position.set(32.77, 0.25, 108);
        this.scene.add(extractionRing);

        // Adicionar luzes neon para estilo Sci-Fi
        const lightColors = [0x00aaff, 0xff5500, 0x00ff88];
        const generatorPositions = [
            new THREE.Vector3(24.77, 0.2, 70), // Gerador 1
            new THREE.Vector3(40.77, 0.2, 70), // Gerador 2
            new THREE.Vector3(32.77, 0.2, 80)  // Gerador 3
        ];

        generatorPositions.forEach((pos, idx) => {
            // Criar base do gerador
            const genMat = new THREE.MeshStandardMaterial({
                color: 0x2d3238,
                roughness: 0.5,
                metalness: 0.9,
                emissive: lightColors[idx],
                emissiveIntensity: 0.1
            });
            const genMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 2), genMat);
            genMesh.position.copy(pos);
            genMesh.position.y += 1.25;
            genMesh.castShadow = true;
            genMesh.receiveShadow = true;
            this.scene.add(genMesh);
            this.SetStaticCollider(genMesh, false);

            // Núcleo brilhante
            const coreMat = new THREE.MeshBasicMaterial({ color: lightColors[idx] });
            const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), coreMat);
            coreMesh.position.copy(pos);
            coreMesh.position.y += 2.8;
            this.scene.add(coreMesh);

            // Luz do gerador
            const light = new THREE.PointLight(lightColors[idx], 3, 10);
            light.position.copy(coreMesh.position);
            this.scene.add(light);

            this.generators.push({
                mesh: genMesh,
                coreMesh: coreMesh,
                light: light,
                pos: pos.clone(),
                active: false,
                color: lightColors[idx]
            });
        });
    }

    CreatePlatform(position, scale, material){
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
        mesh.position.copy(position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Prepara para o Navmesh (atualiza matriz e extrai a geometria posicionada)
        mesh.updateMatrixWorld(true);
        const geom = mesh.geometry.clone();
        geom.applyMatrix4(mesh.matrixWorld);
        this.extraGeometries.push(geom);

        // Adiciona colisor físico
        this.SetStaticCollider(mesh, false);
        return mesh;
    }


    SetStaticCollider(mesh, useIdentity = false){
        const shape = createConvexHullShape(mesh);
        const mass = 0;
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        
        if (!useIdentity) {
            const origin = mesh.position;
            transform.setOrigin(new Ammo.btVector3(origin.x, origin.y, origin.z));
            
            // Copia a rotação também
            const rot = mesh.quaternion;
            transform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
        }

        const motionState = new Ammo.btDefaultMotionState(transform);

        const localInertia = new Ammo.btVector3(0,0,0);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const object = new Ammo.btRigidBody(rbInfo);
        object.parentEntity = this.parent;
        object.mesh = mesh;
  
        this.physicsWorld.addRigidBody(object);
    }

    Initialize(){
        this.LoadScene();
    }
}