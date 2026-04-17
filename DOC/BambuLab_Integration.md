# Blueprint: Integração Bambu Lab Cloud (3DZAAP)

Este documento descreve a arquitetura proposta para a integração automatizada das impressoras Bambu Lab ao **3DZAAP**. O objetivo é ler o progresso e estado da impressão a partir da Cloud da Bambu Lab via MQTT, e atualizar autonomamente a base de dados do 3DZAAP (Supabase), permitindo gestão de stocks e progresso de pedidos sem interação humama manual.

## 1. O Desafio Técnico (Limitação do Browser)
A aplicação atual do 3DZAAP é uma SPA (Single Page Application) focada em tecnologias Web (HTML/JS) que comunica com o Supabase. 
As impressoras Bambu Lab comunicam exclusivamente por protocolo MQTT/TCP (com TLS). Os navegadores web (browsers) por razões de segurança não suportam emissão de raw TCP sockets, falando apenas o protocolo "WebSockets". A impressora não suporta WebSockets passivamente de fábrica. 

Por isso, **a arquitetura exige obrigatoriamente um microsserviço de Backend.**

## 2. Visão Geral da Arquitetura Proposta

A arquitetura baseia-se num **Microsserviço Node.js** a correr em background (numa VPS).

1. **Frontend (3DZAAP Browser):** Interface onde o utilizador insere as credenciais da impressora/Cloud.
2. **Supabase (DB):** Funciona como a State Machine (guarda os tokens seguros e regista alterações no Material/Pedido).
3. **Backend (Node.js Service):** Lê os tokens no Supabase e abre conexões MQTT seguras com o broker da Bambu Lab, escutando eventos de impressão 24/7.


## 3. Workflow de Sincronização e Regras de Negócio

1. **Associação do Device:** 
   No módulo de impressoras, o utilizador fornece o Hostname/IP, Access Code e Serial Number da P1S/X1C. 
   Estes são gravados na tabela `printers` com forte cifra.

2. **Handshake MQTT:** 
   O Worker Node.js assina um pacote TLS e conecta à impressora/Cloud:
   - Topic de listen: `device/[serial_number]/report`
   - Topic de comando: `device/[serial_number]/request`

3. **Interseção de Fim de Impressão:**
   A impressora emite evento *gcode_state="FINISH"*. No payload, especifica o consumo de material (ex: sub_task -> total_weight).
   O Backend:
   - Aciona a API de abate de stock (Supabase) deduzindo o peso do material em uso.
   - Põe a transação no `sync_logs`.
   - Modifica o status da encomenda ligada a essa mesma máquina para "Concluído".

## 4. O Payload Expectável (via MQTTS)
Exemplo do payload decifrado da Bambu Lab, cujo backend precisará de converter para os campos estáticos do 3DZAAP:

```json
{
  "print": {
    "bed_temper": 60.5,
    "mc_print_stage": 1,
    "mc_percent": 100,
    "gcode_state": "FINISH",
    "vt_tray": {
      "id": "1",
      "tray_color": "000000FF",
      "tray_info_idx": "PLA"
    }
  }
}
```

## 5. Estimativa de Custos de Infraestrutura
- O Backend para MQTT pode processar milhares de ligações assimétricas. Uma VPS simples (Linux) com Node.js custará cerca de **5€/mês** inicialmente (ex: Hetzner ou DigitalOcean). 
- **Escalabilidade:** O Supabase suporta sem entraves os queries decorrentes da escuta do Backend. O Backend será o único nó com crescimento horizontal requerido.
