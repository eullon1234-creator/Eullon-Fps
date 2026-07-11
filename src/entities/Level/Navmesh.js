import * as THREE from 'three';
import Component from '../../Component'

import {Pathfinding} from 'three-pathfinding'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils'


export default class Navmesh extends Component{
    constructor(scene, mesh){
        super();
        this.scene = scene;
        this.name = "Navmesh";
        this.zone = "level1";
        this.mesh = mesh;
    }

    Initialize(){
        this.pathfinding = new Pathfinding();

        const geometries = [];
        this.mesh.traverse( ( node ) => {
            if(node.isMesh){ 
                node.updateMatrixWorld();
                const geom = node.geometry.clone();
                geom.applyMatrix4(node.matrixWorld);
                geometries.push(geom);
            }
        });

        if (geometries.length > 0) {
            const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
            this.pathfinding.setZoneData(this.zone, Pathfinding.createZone(mergedGeometry));
        }
    }

    GetRandomNode(p, range){
        if (!p) return null;
        const groupID = this.pathfinding.getGroup(this.zone, p);
        if (groupID === null) {
            console.warn(`[Navmesh] GetRandomNode: Position (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) is off the navmesh.`);
            return null;
        }
        return this.pathfinding.getRandomNode(this.zone, groupID, p, range);
    }

    FindPath(a, b){
        if (!a || !b) return null;
        const groupID = this.pathfinding.getGroup(this.zone, a);
        if (groupID === null) {
            console.warn(`[Navmesh] FindPath: Start position (${a.x.toFixed(2)}, ${a.y.toFixed(2)}, ${a.z.toFixed(2)}) is off the navmesh.`);
            return null;
        }
        return this.pathfinding.findPath(a, b, this.zone, groupID);
    }
}