import { Room } from "colyseus.js";
import { RTClient } from "./RTClient";

export interface IRTClientManagerRoom {
    loading?: boolean;
    room?: Room;
}

export interface IRTClientManagerData {
    client: RTClient;
    rooms: Map<string, IRTClientManagerRoom>;
}

export class RTClientManagerInstance {

    // location => IRTClientManagerData
    clients: Map<string, IRTClientManagerData> = new Map();
    constructor(){}

    getOrCreateClient(endpoint: string, location: string, debug: boolean): IRTClientManagerData {
        if(this.clients.has(location)) return this.clients.get(location)!;
        this.clients.set(location, {
            client: new RTClient(endpoint, location, debug),
            rooms: new Map(),
        });
        this.log(`Created new RTClient at location ${location}`)
        return this.clients.get(location)!;
    }

    async joinOrCreateRoom(location: string, roomName: string){
        const clientData = this.clients.get(location);
        if(clientData?.rooms.has(roomName)) return clientData.rooms.get(roomName)!;
        if(clientData){
            clientData.rooms.set(roomName, { loading: true }); //Indicate loading
            const room = await clientData.client.connect({
                location,
                roomName,
            });
            if(room) clientData.rooms.set(roomName, { room });
        }
    }

    log(...args: any[]) {
        log(`[ 🏆 RTClientManager 🏆 ]`, ...args)
    }
}

export const RTClientManager = new RTClientManagerInstance();