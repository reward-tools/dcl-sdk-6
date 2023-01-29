import { getCurrentRealm, Realm } from "@decentraland/EnvironmentAPI";
import { getUserData, UserData } from "@decentraland/Identity";
import { signedFetch } from "@decentraland/SignedFetch";
import { Room } from "colyseus.js";
import { Dash_Wait } from "dcldash";
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
        public rtProps: Partial<IBoothProps>,
        public baseParcel: string,
        public onAlert?: (alert: string) => void,
        public rewardId?: string,
        public endpoint: string = `https://api.reward.tools`,
        public debug: boolean = false,
    ) {
        this.booth = new Booth({
            transformArgs: rtProps.transformArgs!,
            buttonText: `Claim this POAP`,
            onButtonClick: () => { },
            wrapTexturePath: `poap_assets/images/wrap1.png`,
            dispenserModelPath: `poap_assets/models/POAP_dispenser.glb`,
            buttonModelPath: `poap_assets/models/POAP_button.glb`,
            ...rtProps,
        })
        this.booth.button.addComponentOrReplace(new OnPointerDown(() => {
            this.booth.onButtonClick();
            this.booth.button.getComponent(Animator).getClip('Button_Action').play();
            Dash_Wait(() => {
                this.booth.button.getComponent(Animator).getClip('Button_Action').stop();
            }, 1)
        }, {
            hoverText: `Claim Attendance Token`,
        }))
        this.client = new RTClient(this.endpoint, this.debug);
        executeTask(async () => {
            await this.loadUserData();
            this.initialized = true;
            this.booth.onButtonClick = () => this.getButtonClick();
            if (this.rewardId) {
                this.setRewardId(this.rewardId);
            }
            this.room = await this.client.connect(`update`, {
                location: this.baseParcel,
            });
            if(!this.room) this.log(`Failed to connect to reward.tools Client`)
        })
    }

    async loadUserData() {
        this.userData = await getUserData();
        this.realm = await getCurrentRealm();
    }

    async getReward(rewardId: string): Promise<any> {
        try {
            const address = this.userData?.userId;
            const displayName = this.userData?.displayName;
            const callUrl = `${this.endpoint}/v1/quest/fetch`;
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
            this.debug && this.log(`RTPOAPBooth Fetch Error: ${err.message}`)
            return null
        }
    }

    async getButtonClick() {
        let prevClick = this.lastClick;
        this.lastClick = new Date();
        if (prevClick.getTime() + 5000 > this.lastClick.getTime()) {
            this.onAlert?.(`Warning: Please don't spam the POAP booth`);
            return
        }
        void executeTask(async () => {
            try {
                this.debug && this.log("Claiming POAP", { rewardId: this.rewardId })
                this.onAlert?.("Attempting to claim POAP... Please wait...")
                const userData = await getUserData();
                const realm = await getCurrentRealm();
                if (!userData?.hasConnectedWeb3) {
                    this.onAlert?.(`Login with an Ethereum Wallet to claim this POAP`);
                    return;
                }
                const address = userData?.publicKey;
                const displayName = userData?.displayName;
                const callUrl = `${this.endpoint}/v1/poap/claim`;
                let response = await signedFetch(callUrl, {
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                    body: JSON.stringify({
                        address,
                        displayName,
                        rewardId: this.rewardId,
                        realm,
                        timezone: new Date().toString(),
                    }),
                })
                let json = JSON.parse(response.text ?? "");
                const { message } = json;
                this.debug && this.log("Reward claim", { json })
                this.onAlert?.(message)
            } catch (err: any) {
                this.onAlert?.(err?.message ?? `An error has occcured`)
            }
        })
    }

    async setRewardId(rewardId: string) {
        this.debug && this.log(`setRewardID`, rewardId)
        this.rewardId = rewardId;
        if (!this.initialized) {
            this.debug && this.log(`RTPOAPBooth not initialized. Waiting 5 seconds to reattempt..`)
            Dash_Wait(() => {
                this.setRewardId(rewardId);
            }, 5)
            return;
        }
        try {
            const reward = await this.getReward(rewardId);
            if (reward == null) {
                this.onAlert?.(`Reward not found`);
                return;
            }
            this.rewardData = reward?.data;
            this.debug && this.log(`Got Reward`, this.rewardData)
            this.booth.setImage(
                this.rewardData.imageUrl,
                `https://poap.gallery/event/${this.rewardData.event_id}`,
                `View Event on POAP.gallery`
            )
        } catch (err: any) {
            this.debug && this.log(`Got Error`, err.message)
        }
    }

    log(...args: any[]) {
        log(`[ 🏆 RewardTools POAPBooth 🏆 ]`, ...args)
    }
}
