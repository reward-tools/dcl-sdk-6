///<reference lib="es2015.symbol" />
///<reference lib="es2015.symbol.wellknown" />
///<reference lib="es2015.collection" />
///<reference lib="es2015.iterable" />

import { Client, Room } from "colyseus.js";
import { getCurrentRealm } from "@decentraland/EnvironmentAPI";
import { getUserData } from "@decentraland/Identity";
import { Dash_Wait } from "dcldash";

export class RTClient {

    room?: Room;
    options?: any;
    client: Client;
    attempts = 0;

    constructor(public endpoint: string, public debug: boolean = true) {
        this.client = new Client(this.endpoint);
    }

    async connect(roomName: string, options: any = {}): Promise<Room | null> {

        //An ID for debugging connection instances
        const rand = Math.random().toString();
        const id = rand.substring(rand.length-5);

        //Record attempts. In case of disconnect we will use this to time the reconnection attempt
        this.attempts++;
        if (this.attempts > 15) this.attempts = 15;
        this.debug && this.log(`Attempting connection to server id:${id} (attempts: ${this.attempts})`)

        //Populate user and options
        options.realm = await getCurrentRealm();
        options.userData = await getUserData();
        options.timezone = new Date().toString();
        this.options = options;
        const handleReconnection = () => {
            Dash_Wait(() => this.connect(roomName, options), this.attempts);
        }
        try {
            this.room = await this.client.joinOrCreate<any>(roomName, options);
            this.onConnected(id);
            this.room.onStateChange((state) => {
                this.debug && this.log(`STATE CHANGE`, state)
            });
            this.room.onLeave((code) => {
                this.debug && this.log(`Left, id:${id} code =>`, code);
                this.onDisconnect(id, handleReconnection);
            });
            this.room.onError((code) => {
                this.debug && this.log(`Error, id:${id} code =>`, code);
            });
            return this.room;
        } catch (e: any) {
            this.onDisconnect(id, handleReconnection);
            return null;
        }
    }

    onConnected(id: string) {
        this.debug && this.log(`Connected to socket server (id:${id})`);
        this.attempts = 0;
    }

    onDisconnect(id: string, reconnect: () => void) {
        this.debug && this.log(`Disconnected from socket server (id:${id})`);
        reconnect();
    }

    log(...args: any[]) {
        log(`[ 🏆 RewardToolsClient 🏆 ]`, ...args)
    }
}