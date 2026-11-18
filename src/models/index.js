import { ace75_8k } from './ace75-8k.js';
import { ace75_16k } from './ace75-16k.js';

// Add new models here with verified: false until a hardware test (see docs/ADDING_A_MODEL.md); unverified models stay read-only.
export const models = [ace75_8k, ace75_16k];

/** @param {number} vid @param {number} pid */
export const findModel = (vid, pid) => models.find(m => m.vid === vid && m.pid === pid);

/** Vendor-wide, so a keyboard that is not in the registry yet can still be picked and reported (it is never written). */
export const hidFilters = () => [...new Set(models.map(m => m.vid))].map(vendorId => ({ vendorId }));
