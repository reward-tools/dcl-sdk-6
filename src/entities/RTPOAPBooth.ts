import { getCurrentRealm, isPreviewMode, Realm } from "@decentraland/EnvironmentAPI";
import { getUserData, UserData } from "@decentraland/Identity";
import { signedFetch } from "@decentraland/SignedFetch";
import { Room } from "colyseus.js";
import { Dash_Wait } from "dcldash";
import { RTClientManager } from "src/client/RTClientManager";
import { Booth, IBoothProps } from "zootools";
import { RTClient } from "../client/RTClient";

export class RTPOAPBooth {

    public booth: Booth;
    public client!: RTClient;
    public room?: Room | null;
    public initialized: boolean = false;
    public userData!: UserData | null;
    public realm!: Realm | undefined;
    public rewardData!: any;
    public lastClick: Date = new Date(new Date().getTime() - 5000);

    constructor(
        public rtProps: Partial<IBoothProps> & {
            transformArgs: TransformConstructorArgs;
            baseParcel: string;
            onAlert?: (alert: string) => void;
            rewardId?: string;
            endpoint?: string;
            debug?: boolean;
        },
    ) {
        if (rtProps?.debug == undefined) this.rtProps.debug = false;
        if (rtProps?.endpoint == undefined) this.rtProps.endpoint = `https://api.reward.tools`;
        this.booth = new Booth({
            buttonText: `Claim this POAP`,
            onButtonClick: () => { },
            wrapTexturePath: `poap_assets/images/wrap1.png`,
            dispenserModelPath: `poap_assets/models/POAP_dispenser.glb`,
            buttonModelPath: `poap_assets/models/POAP_button.glb`,
            ...rtProps,
        })
        this.client = (RTClientManager.getOrCreateClient(
            this.rtProps.endpoint!, 
            this.rtProps.baseParcel!, 
            this.rtProps.debug!,
        )).client;
        void this.connection();
        executeTask(async () => {
            await this.loadUserData();
            this.initialized = true;
            this.setOnButtonClick();
            if (this.rtProps?.rewardId) this.setRewardId(this.rtProps.rewardId);
        });
    }

    async connection(){
        const mngrRoom = await RTClientManager.joinOrCreateRoom(
            this.rtProps.baseParcel,
            `update`,
        );
        if(mngrRoom?.loading === true){
            Dash_Wait(() => {
                this.log(`Room is still loading. Waiting 5 Seconds for reattempt.`)
                this.connection();
            }, 5);
            return;
        }
        if(!mngrRoom?.room){
            this.log(`Failed to connect to reward.tools Client`)
            return;
        }
        this.room = mngrRoom.room;
    }

    async loadUserData() {
        this.userData = await getUserData();
        this.realm = await getCurrentRealm();
    }

    async getReward(rewardId: string): Promise<any> {
        try {
            const address = this.userData?.userId;
            const displayName = this.userData?.displayName;
            const callUrl = `${this.rtProps.endpoint!}/v1/quest/fetch`;
            const response = await signedFetch(callUrl, {
                headers: { "Content-Type": "application/json" },
                method: "POST",
                body: JSON.stringify({
                    address,
                    displayName,
                    rewardId,
                }),
            })
            const json = JSON.parse(response.text ?? "");
            if (response.status !== 200) throw Error(json?.message);
            return json
        } catch (err: any) {
            this.rtProps.debug! && this.log(`RTPOAPBooth Fetch Error: ${err.message}`)
            return null
        }
    }

    async setRewardId(rewardId: string) {
        this.rtProps.debug && this.log(`setRewardID`, rewardId)
        this.rtProps.rewardId = rewardId;
        if (!this.initialized) {
            this.rtProps.debug && this.log(`RTPOAPBooth not initialized. Waiting 5 seconds to reattempt..`)
            Dash_Wait(() => {
                this.setRewardId(rewardId);
            }, 5)
            return;
        }
        try {
            const reward = await this.getReward(rewardId);
            if (reward == null) {
                const isPreview = await isPreviewMode();
                if(isPreview){
                    this.rtProps.onAlert?.(`Deploy your scene to claim POAP`);
                }else{
                    this.rtProps.onAlert?.(`Reward not found`);
                }
                return;
            }
            this.rewardData = reward?.data;
            this.rtProps.debug && this.log(`Got Reward`, this.rewardData)
            this.booth.setImage(
                this.rewardData.imageUrl,
                `https://poap.gallery/event/${this.rewardData.event_id}`,
                `View Event on POAP.gallery`
            )
            this.setOnButtonClick();
        } catch (err: any) {
            this.rtProps.debug && this.log(`Got Error`, err.message)
        }
    }

    async getButtonClick() {
        let prevClick = this.lastClick;
        this.lastClick = new Date();
        if (prevClick.getTime() + 5000 > this.lastClick.getTime()) {
            this.rtProps.onAlert?.(`Warning: Please don't spam the POAP booth`);
            return
        }
        void executeTask(async () => {
            try {
                this.rtProps.debug! && this.log("Claiming POAP", { rewardId: this.rtProps.rewardId })
                this.rtProps.onAlert?.("Attempting to claim POAP... Please wait...")
                const userData = await getUserData();
                const realm = await getCurrentRealm();
                if (!userData?.hasConnectedWeb3) {
                    this.rtProps.onAlert?.(`Login with an Ethereum Wallet to claim this POAP`);
                    return;
                }
                const address = userData?.publicKey;
                const displayName = userData?.displayName;
                const callUrl = `${this.rtProps.endpoint!}/v1/poap/claim`;
                const response = await signedFetch(callUrl, {
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                    body: JSON.stringify({
                        address,
                        displayName,
                        rewardId: this.rtProps.rewardId,
                        realm,
                        timezone: new Date().toString(),
                    }),
                })
                this.log("response",response.status, response.statusText)
                const json = JSON.parse(response.text ?? "");
                const { message } = json;
                this.rtProps.debug && this.log("Reward claim", { json })
                this.rtProps.onAlert?.(message)
            } catch (err: any) {
                this.log("err",err.status, err.statusText)
                this.rtProps.onAlert?.(err?.message ?? `An error has occcured`)
            }
        })
    }

    setOnButtonClick(){
        this.booth.onButtonClick = () => this.getButtonClick();
        this.booth.button.addComponentOrReplace(new OnPointerDown(() => {
            this.booth.onButtonClick();
            this.booth.button.getComponent(Animator).getClip('Button_Action').play();
            Dash_Wait(() => {
                this.booth.button.getComponent(Animator).getClip('Button_Action').stop();
            }, 1)
        }, {
            hoverText: `Claim Attendance Token`,
        }))
    }

    log(...args: any[]) {
        log(`[ 🏆 RTPOAPBooth 🏆 ]`, ...args)
    }
}