import { InAppUpdateInfo } from '../types';

let inAppUpdatesModule: any = null;

try {
  const SpInAppUpdates = require('sp-react-native-in-app-updates').default;
  inAppUpdatesModule = new SpInAppUpdates(false); // false = production mode
} catch (e) {
  inAppUpdatesModule = null;
}

/**
 * Checks Google Play Store for available app updates
 */
export async function checkAppUpdates(): Promise<InAppUpdateInfo> {
  if (!inAppUpdatesModule) {
    return {
      shouldUpdate: false,
    };
  }

  try {
    const result = await inAppUpdatesModule.checkNeedsUpdate();
    return {
      shouldUpdate: result.shouldUpdate || false,
      updatePriority: result.other?.updatePriority || 0,
      availableVersionCode: result.other?.versionCode,
    };
  } catch (error) {
    console.warn('In-App Update check failed:', error);
    return { shouldUpdate: false };
  }
}

/**
 * Triggers the update flow (FLEXIBLE or IMMEDIATE)
 */
export async function startAppUpdate(isImmediate: boolean = false): Promise<void> {
  if (!inAppUpdatesModule) return;

  try {
    const { IAUUpdateKind } = require('sp-react-native-in-app-updates');
    const updateType = isImmediate ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE;

    await inAppUpdatesModule.startUpdate({
      updateType,
    });
  } catch (error) {
    console.warn('Failed to start In-App Update flow:', error);
  }
}
