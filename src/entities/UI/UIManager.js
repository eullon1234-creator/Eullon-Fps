import Component from '../../Component'

export default class UIManager extends Component{
    constructor(){
        super();
        this.name = 'UIManager';
    }

    SetAmmo(mag, rest){
        document.getElementById("current_ammo").innerText = mag;
        document.getElementById("max_ammo").innerText = rest;
    }

    SetHealth(health){
        document.getElementById("health_progress").style.width = `${health}%`;
    }

    Initialize(){
        document.getElementById("game_hud").style.visibility = 'visible';
        document.getElementById("result_screen").style.display = 'none';
        document.getElementById("interact_prompt").style.display = 'none';
        document.getElementById("notification_banner").style.display = 'none';
    }

    SetMissionText(text){
        const el = document.getElementById("mission_text");
        if (el) el.innerText = text;
    }

    ShowInteractPrompt(text){
        const el = document.getElementById("interact_prompt");
        if (el) {
            el.innerText = text;
            el.style.display = 'block';
        }
    }

    HideInteractPrompt(){
        const el = document.getElementById("interact_prompt");
        if (el) el.style.display = 'none';
    }

    ShowNotification(text){
        const el = document.getElementById("notification_banner");
        if (el) {
            el.innerText = text;
            el.style.display = 'block';
            
            // Esconde após 3 segundos
            if (this.notifTimeout) clearTimeout(this.notifTimeout);
            this.notifTimeout = setTimeout(() => {
                el.style.display = 'none';
            }, 3000);
        }
    }

    ShowResultScreen(victory){
        // Mostra a tela de resultado
        const screen = document.getElementById("result_screen");
        const title = document.getElementById("result_title");
        const sub = document.getElementById("result_sub");

        if (screen) {
            screen.style.display = 'flex';
            if (victory) {
                title.innerText = "MISSÃO CUMPRIDA";
                title.style.color = "#00ff88";
                title.style.textShadow = "0 0 20px #00ff88";
                sub.innerText = "Você purificou a base e escapou com segurança!";
            } else {
                title.innerText = "AGENTE ELIMINADO";
                title.style.color = "#ff3b30";
                title.style.textShadow = "0 0 20px #ff3b30";
                sub.innerText = "Você sucumbiu à infestação de mutantes.";
            }
        }

        // Destrava cursor para o jogador poder clicar em reiniciar
        document.exitPointerLock();
    }
}