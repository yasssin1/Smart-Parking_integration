import paho.mqtt.client as mqtt
import json
import time

# --- CONFIGURATION À MODIFIER ---
BROKER = "broker.emqx.io"
PORT = 1883
# Chaque personne doit changer ce ID (ex: SmartPark2026_P1)
CLIENT_ID = "SmartPark2026_PX" 

# --- LOGIQUE DE RÉCEPTION ---
def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"📥 Message reçu sur {msg.topic}: {payload}")
        # AJOUTER TA LOGIQUE ICI (ex: si topic == barrière alors...)
    except Exception as e:
        print(f"⚠️ Erreur de format : {e}")

# --- INITIALISATION ---
client = mqtt.Client(client_id=CLIENT_ID)
client.on_message = on_message

print(f"🔌 Connexion au broker {BROKER}...")
client.connect(BROKER, PORT)

# --- ABONNEMENTS ---
# Exemple : client.subscribe("smart_parking_2026/parking/spots/+/status")
client.subscribe("smart_parking_2026/parking/#") # Pour tester, on écoute tout

client.loop_start() # Démarre la surveillance en arrière-plan

try:
    while True:
        # --- LOGIQUE D'ENVOI ---
        # Exemple pour P1 :
        # data = {"id": "A1", "status": "FREE"}
        # client.publish("smart_parking_2026/parking/spots/A1/status", json.dumps(data))
        
        time.sleep(5) 
except KeyboardInterrupt:
    print("Arrêt du module.")
    client.disconnect()