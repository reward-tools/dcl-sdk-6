///<reference lib="es2015.symbol" />
///<reference lib="es2015.symbol.wellknown" />
///<reference lib="es2015.collection" />
///<reference lib="es2015.iterable" />

import { Client, Room } from "colyseus.js";
import { getCurrentRealm } from "@decentraland/EnvironmentAPI";
import { getUserData } from "@decentraland/Identity";
import { Dash_Wait } from "dcldash";
import { makeid } from "zootools";

export class RTClient {
    
    options?: any;
    client: Client;
    room?: Room;
    attempts: number = 0;
    connecting: boolean = false;
    onRoomConnectedCbs: ((room: Room) => void)[] = [];

    constructor(public endpoint: string) {
        this.client = new Client(this.endpoint); 
    }

    onRoomConnected(cb: (room: Room) => void){
        this.onRoomConnectedCbs.push(cb);
        this.options.debug && this.log(`onRoomConnected Callback was set`)
    }

    setConfig(location: string, roomName: string, debug: boolean){
        if(this.options === undefined || (this.options.location !== location && this.options.roomName !== roomName)){
            this.options = {};
            this.options.location = location;
            this.options.roomName = roomName;
            this.options.debug = debug;
            this.connect({
                location,
                roomName,
                debug,
            })
            this.options.debug && this.log(`Config was set`)
        }
    }

    async connect(options: any & {
        location: string;
        roomName: string;
        debug?: boolean;
    } = this.options): Promise<Room | null> {

        if(options.debug == undefined) this.options.debug = false;
        else this.options.debug = options.undefined;

        //An ID for debugging connection instances
        const id = makeid(5);

        //Record attempts. In case of disconnect we will use this to time the reconnection attempt
        this.attempts++;
        if (this.attempts > 15) this.attempts = 15;
        this.options.debug && this.log(`Attempting connection to server id:${id} (attempts: ${this.attempts})`)
        
        //Populate user and options
        options.realm = await getCurrentRealm();
        options.userData = await getUserData();
        options.timezone = new Date().toString();

        //Ensure avatars are pointed to content servers
        const regex = /^https?:\/\/[^\/]+\.[^\/]+\/content\/contents\/[a-zA-Z0-9]+$/;
        const snapshots = options?.userData?.avatar?.snapshots;
        Object.keys(snapshots).forEach(key => {
            const snapshot = snapshots[key];
            if (!regex.test(snapshot)) {
                delete options.userData.avatar.snapshots[key];
            }
        });

        this.options = options;
        const handleReconnection = () => {
            Dash_Wait(() => this.connect(options), this.attempts);
        }

        try {
            this.room = await this.client.joinOrCreate<any>(options.roomName, options);
            if(this.room){
                this.onRoomConnectedCbs.forEach(cb => cb(this.room!));
                this.onConnected(id);
                this.room.onStateChange((state) => {
                    this.options.debug && this.log(`STATE CHANGE`, state)
                });
                this.room.onLeave((code) => {
                    this.options.debug && this.log(`Left, id:${id} code =>`, code);
                    this.onDisconnect(id, handleReconnection);
                });
                this.room.onError((code) => {
                    this.options.debug && this.log(`Error, id:${id} code =>`, code);
                });
            }
            return this.room;
        } catch (e: any) {
            this.onDisconnect(id, handleReconnection);
            return null;
        }
    }

    onConnected(id: string) {
        this.options.debug && this.log(`Connected to socket server (id:${id})`);
        this.attempts = 0;
    }

    onDisconnect(id: string, reconnect: () => void) {
        this.options.debug && this.log(`Disconnected from socket server (id:${id})`);
        reconnect();
    }

    log(...args: any[]) {
        log(`[ 🏆 RTClient 🏆 ]`, ...args)
    }
}

export const rtClient = new RTClient(`wss://api.reward.tools`);