import { getCurrentRealm, isPreviewMode, Realm } from "@decentraland/EnvironmentAPI";
import { getUserData, UserData } from "@decentraland/Identity";
import { signedFetch } from "@decentraland/SignedFetch";
import { Room } from "colyseus.js";
import { Dash_Wait } from "dcldash";
import { Booth, IBoothProps } from "zootools";
import { rtClient, RTClient } from "../client/RTClient";

export class RTBooth {

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
            useClient?: boolean;
        },
    ) {
        if (rtProps?.debug == undefined) this.rtProps.debug = false;
        if (rtProps?.endpoint == undefined) this.rtProps.endpoint = `https://api.reward.tools`;
        this.booth = new Booth({
            buttonText: `Claim this Item`,
            onButtonClick: () => { },
            wrapTexturePath: `images/wrap1.png`,
            dispenserModelPath: `models/dispenser.glb`,
            buttonModelPath: `models/button.glb`,
            ...rtProps,
        });
        if (rtProps.useClient) {
            this.client = rtClient;
            this.client.setConfig(
                this.rtProps.baseParcel,
                `update`,
                this.rtProps.debug!,
            );
            this.client.onRoomConnected((room: Room) => {
                this.room = room;
            });
        }
        executeTask(async () => {
            await this.initialize();
        });
    }

    async initialize() {
        if (this.initialized) return true
        this.initialized = true;
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
            return json;
        } catch (err: any) {
            this.rtProps.debug! && this.log(`Fetch Error: ${err.message}`)
            return null;
        }
    }

    async setDCLAirdropId(rewardId: string) {
        await this.initialize();
        this.rtProps.debug && this.log(`Reward ID was set: `, rewardId);
        this.rtProps.rewardId = rewardId;
        if (!this.initialized) {
            this.rtProps.debug && this.log(`not initialized. Waiting 5 seconds to reattempt..`)
            Dash_Wait(() => {
                this.setDCLAirdropId(rewardId);
            }, 5)
            return;
        }
        try {
            const reward = await this.getReward(rewardId);
            if (reward == null) {
                const isPreview = await isPreviewMode();
                if (isPreview) {
                    this.rtProps.onAlert?.(`Deploy your scene to claim items`);
                } else {
                    this.rtProps.onAlert?.(`Reward not found`);
                }
                return;
            }
            this.rewardData = reward?.data;
            this.rtProps.debug && this.log(`Got Reward`, this.rewardData)
            this.booth.setImage(
                this.rewardData.imageUrl,
                `https://market.decentraland.org/contracts/${this.rewardData.contractAddress}/tokens/${this.rewardData.blockchainId}`,
                `View item on Decentraland Marketplace`
            )
            this.setOnButtonClick(`dcl/claim`);
        } catch (err: any) {
            this.rtProps.debug && this.log(`Got Error`, err.message)
        }
    }

    async setPOAPRewardId(rewardId: string) {
        await this.initialize();
        this.rtProps.debug && this.log(`Reward ID was set: `, rewardId);
        this.rtProps.rewardId = rewardId;
        if (!this.initialized) {
            this.rtProps.debug && this.log(`not initialized. Waiting 5 seconds to reattempt..`)
            Dash_Wait(() => {
                this.setPOAPRewardId(rewardId);
            }, 5)
            return;
        }
        try {
            const reward = await this.getReward(rewardId);
            if (reward == null) {
                const isPreview = await isPreviewMode();
                if (isPreview) {
                    this.rtProps.onAlert?.(`Deploy your scene to claim items`);
                } else {
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
            this.setOnButtonClick(`poap/claim`);
        } catch (err: any) {
            this.rtProps.debug && this.log(`Got Error`, err.message)
        }
    }

    async getButtonClick(path: string) {
        let prevClick = this.lastClick;
        this.lastClick = new Date();
        if (prevClick.getTime() + 5000 > this.lastClick.getTime()) {
            this.rtProps.onAlert?.(`Warning: Please don't spam the POAP booth`);
            return
        }
        void executeTask(async () => {
            try {
                this.rtProps.debug! && this.log("Claiming Item", { rewardId: this.rtProps.rewardId })
                this.rtProps.onAlert?.("Attempting to claim item... Please wait...")
                const userData = await getUserData();
                const realm = await getCurrentRealm();
                if (!userData?.hasConnectedWeb3) {
                    this.rtProps.onAlert?.(`Login with an Ethereum Wallet to claim this item`);
                    return;
                }
                const address = userData?.publicKey;
                const displayName = userData?.displayName;
                const callUrl = `${this.rtProps.endpoint!}/v1/${path}`;
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
                const json = JSON.parse(response.text ?? "");
                if (response.status !== 200) throw Error(json?.message);
                const { message } = json;
                this.rtProps.debug && this.log("Reward claim", { json })
                this.rtProps.onAlert?.(message)
            } catch (err: any) {
                this.rtProps.onAlert?.(err?.message ?? `An error has occcured`)
            }
        })
    }

    setOnButtonClick(path: string) {
        this.booth.onButtonClick = () => this.getButtonClick(path);
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