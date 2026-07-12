import Component from '../../Component'
import * as THREE from 'three'
import Entity from '../../Entity'
import NpcCharacterController from '../NPC/CharacterController'
import AttackTrigger from '../NPC/AttackTrigger'
import CharacterCollision from '../NPC/CharacterCollision'
import DirectionDebug from '../NPC/DirectionDebug'
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils'
import Input from '../../Input'

export default class MissionManager extends Component {
    constructor(gameApp) {
        super();
        this.name = 'MissionManager';
        this.gameApp = gameApp;

        this.currentMissionIndex = 0;
        this.activeEnemies = 0;
        this.generatorsActivated = 0;
        this.extractionTimer = 0;
        this.extractionRequiredTime = 20.0; // 20 segundos de extração
        this.spawnTimer = 0;

        this.missionList = [
            "Eliminar mutantes na área inicial",
            "Ativar os 3 geradores na nova área [Pressione E]",
            "Sobreviver na zona de extração!",
            "Missão Cumprida! Base Purificada."
        ];

        this.interactPromptShown = false;
        this.victoryOrDefeatEnded = false;
    }

    Initialize() {
        this.levelSetup = this.FindEntity('Level').GetComponent('LevelSetup');
        this.uimanager = this.FindEntity('UIManager').GetComponent('UIManager');
        this.player = this.FindEntity('Player');

        // Conta quantos inimigos iniciais temos no mapa
        this.activeEnemies = this.CountAliveEnemies();

        this.UpdateMissionHUD();
    }

    CountAliveEnemies() {
        let count = 0;
        const entities = this.parent.parent.entities;
        entities.forEach(ent => {
            if (ent.Name && ent.Name.startsWith('Mutant')) {
                const ctrl = ent.GetComponent('CharacterController');
                if (ctrl && ctrl.health > 0) {
                    count++;
                }
            }
        });
        return count;
    }

    UpdateMissionHUD() {
        if (!this.uimanager) return;

        let details = "";
        if (this.currentMissionIndex === 0) {
            details = ` (${this.activeEnemies} restantes)`;
        } else if (this.currentMissionIndex === 1) {
            details = ` (${this.generatorsActivated}/3)`;
        } else if (this.currentMissionIndex === 2) {
            const timeRemaining = Math.max(0, this.extractionRequiredTime - this.extractionTimer);
            details = ` (${timeRemaining.toFixed(1)}s)`;
        }

        const missionText = `OBJETIVO: ${this.missionList[this.currentMissionIndex]}${details}`;
        this.uimanager.SetMissionText(missionText);
    }

    SpawnMutant(pos) {
        const npcEntity = new Entity();
        npcEntity.SetPosition(pos.clone());
        const id = Math.floor(Math.random() * 10000);
        npcEntity.SetName(`MutantSpawned_${id}`);

        const modelClone = SkeletonUtils.clone(this.gameApp.assets['mutant']);
        const controller = new NpcCharacterController(
            modelClone,
            this.gameApp.mutantAnims,
            this.gameApp.scene,
            this.gameApp.physicsWorld
        );

        npcEntity.AddComponent(controller);
        npcEntity.AddComponent(new AttackTrigger(this.gameApp.physicsWorld));
        npcEntity.AddComponent(new CharacterCollision(this.gameApp.physicsWorld));
        npcEntity.AddComponent(new DirectionDebug(this.gameApp.scene));

        this.parent.parent.Add(npcEntity);

        // Inicializa os componentes manualmente já que o jogo já começou
        npcEntity.components['CharacterController'].Initialize();
        npcEntity.components['AttackTrigger'].Initialize();
        npcEntity.components['CharacterCollision'].Initialize();
        npcEntity.components['DirectionDebug'].Initialize();

        this.activeEnemies++;
        this.UpdateMissionHUD();
    }

    Update(timeElapsed) {
        if (this.victoryOrDefeatEnded) return;

        // Verifica se o jogador morreu
        const playerHealth = this.player.GetComponent('PlayerHealth');
        if (playerHealth && playerHealth.health <= 0) {
            this.TriggerGameOver(false);
            return;
        }

        this.activeEnemies = this.CountAliveEnemies();

        // Máquina de estado das missões
        if (this.currentMissionIndex === 0) {
            // Missão 1: Eliminar mutantes iniciais
            if (this.activeEnemies === 0) {
                this.currentMissionIndex = 1;
                this.uimanager.ShowNotification("ZONA INICIAL LIMPA! ATIVE OS GERADORES.");
                // Spawnar alguns inimigos na sala dos geradores para dificultar o acesso
                for (let i = 0; i < 3; i++) {
                    const spawnOffset = new THREE.Vector3(
                        32.77 + (Math.random() - 0.5) * 10,
                        0.5,
                        74 + (Math.random() - 0.5) * 10
                    );
                    this.SpawnMutant(spawnOffset);
                }
            }
            this.UpdateMissionHUD();
        } else if (this.currentMissionIndex === 1) {
            // Missão 2: Ativar Geradores
            let playerNearGenerator = false;
            let targetGen = null;

            const playerPos = this.player.Position;

            this.levelSetup.generators.forEach(gen => {
                if (!gen.active) {
                    const dist = playerPos.distanceTo(gen.pos);
                    if (dist < 3.0) {
                        playerNearGenerator = true;
                        targetGen = gen;
                    }
                }
            });

            if (playerNearGenerator && targetGen) {
                this.uimanager.ShowInteractPrompt("Pressione [E] para ativar Gerador");
                this.interactPromptShown = true;

                // Verifica tecla E do input
                if (Input.KeyDown('e')) {
                    targetGen.active = true;
                    targetGen.light.color.setHex(0xff0000); // muda luz para vermelho/alerta
                    targetGen.coreMesh.material.color.setHex(0xff0000);
                    this.generatorsActivated++;
                    
                    this.uimanager.ShowNotification(`GERADOR ${this.generatorsActivated}/3 ATIVADO! ALERTA DE HORDA!`);
                    
                    // Spawn de horda
                    for (let i = 0; i < 3; i++) {
                        const spawnPos = new THREE.Vector3(
                            targetGen.pos.x + (Math.random() - 0.5) * 6,
                            0.5,
                            targetGen.pos.z + (Math.random() - 0.5) * 6
                        );
                        this.SpawnMutant(spawnPos);
                    }

                    if (this.generatorsActivated === 3) {
                        this.currentMissionIndex = 2;
                        this.uimanager.ShowNotification("TODOS OS GERADORES ATIVOS! CORRA PARA A EXTRAÇÃO!");
                    }
                    this.UpdateMissionHUD();
                }
            } else {
                if (this.interactPromptShown) {
                    this.uimanager.HideInteractPrompt();
                    this.interactPromptShown = false;
                }
            }
        } else if (this.currentMissionIndex === 2) {
            // Missão 3: Extração
            const playerPos = this.player.Position;
            const extractPos = new THREE.Vector3(32.77, 0, 108);
            const distToExtraction = playerPos.distanceTo(extractPos);

            if (distToExtraction < 5.0) {
                // Jogador está na zona de extração, inicia contagem
                this.extractionTimer += timeElapsed;
                this.uimanager.ShowInteractPrompt(`Extraindo... Aguente firme!`);
                this.interactPromptShown = true;

                if (this.extractionTimer >= this.extractionRequiredTime) {
                    this.currentMissionIndex = 3;
                    this.TriggerGameOver(true);
                }
            } else {
                if (this.interactPromptShown) {
                    this.uimanager.HideInteractPrompt();
                    this.interactPromptShown = false;
                }
            }

            // Spawn contínuo de hordas na extração a cada 4 segundos
            this.spawnTimer += timeElapsed;
            if (this.spawnTimer > 4.0) {
                this.spawnTimer = 0;
                // Spawnar mutante na entrada da ponte de extração para pressionar o jogador
                const spawnPos = new THREE.Vector3(32.77 + (Math.random() - 0.5) * 4, 0.5, 90);
                this.SpawnMutant(spawnPos);
            }

            this.UpdateMissionHUD();
        }
    }

    TriggerGameOver(victory) {
        this.victoryOrDefeatEnded = true;
        this.uimanager.HideInteractPrompt();
        if (this.interactPromptShown) {
            this.uimanager.HideInteractPrompt();
        }

        // Bloqueia controles do jogador se necessário, ou apenas exibe a tela de resultado
        this.uimanager.ShowResultScreen(victory);
    }
}
