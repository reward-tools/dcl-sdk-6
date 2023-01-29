## SDK Library

A library for interacting with https://reward.tools via Decentraland SDK 6.

## Install

To use any of the helpers provided by this library:

1. Install it as an npm package. Run this command in your scene's project folder:

   ```
   npm install -B rt-dcl-sdk-6 dcldash zootools
   ```

2. Add this line at the start of your game.ts file, or any other TypeScript files that require it:

   ```ts
   import * as RewardTools from 'rt-dcl-sdk-6';
   ```

## Usage

### POAP Booth
Spawn a POAP booth.
   ```ts
   import { RTPOAPBooth } from "rt-dcl-sdk-6";
   import { AlertSystem } from "zootools";
   const alertSystem = new AlertSystem();
const dispenser = new RTPOAPBooth(
    {
        transformArgs: {
            position: new Vector3(8, 0, 8),
        },
        baseParcel: `96,99`,
        onAlert: (alert: string) => alertSystem.new(alert),
        //rewardId: ``, //set rewardId here
    },
);
   dispenser.setRewardId("rewardId"); // or here
   engine.addEntity(dispenser.booth);
   ```

Be sure to add the [poap_assets](https://github.com/tyzoo/tyzoo.github.io/tree/master/assets/poap_assets) folder to the root of your scene

## Copyright info

This scene is protected with a standard Apache 2 licence. See the terms and conditions in the [LICENSE](/LICENSE) file.
