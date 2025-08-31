// Hi future me,
//
// Maps are forbidden in settings. They're coerced back into objects by obsidian,
// which typescript never even complains about, because it's a worthless
// overengineered traitorous piece of shit that's a sad excuse of a programming
// language. 
//
// This means any consumers of settings using "Map methods" are actually using
// methods that don't exist in an Object, because fuck you. You don't find out when
// obsidian coerces the type to a map, you don't hear obsidian complaining that
// it has to coerce the map to an object, you find out when you fucking run it.
// It's fucking worse than javascript. JavaScript is harder to statically lint,
// sure, but it has been done, and you're not gonna get shafted because you pick
// roundabout special types just to use special typescript features.
//
// Maps are still fine elsewhere, just not in settings, and not in any obsidian APIs
// where it could be coerced back to an object.
//
// I really should've written this in raw JS. At least JS isn't as outright cancer
// as JS (even though JS still has no business being on the desktop)
//
// "Yes please, I want react in my task bar", "yes please, make everything a browser,
// I really hate having free RAM to do anything else" - deranged sentences made up by
// Microsoft to justify investing in typescript.
// -----------------------------------------------------------------------------------
// Future me here: index signatures are meant to be used here, but fuck that shit. 
// Object is so discouraged it has been disappeared from typescript's notation, but
// getting the types in order is lots of work for no benefit, since the types aren't
// enforced at runtime anyway[^1]. There's probably more fuckery that needs to be done
// with the loadSettings function, but honestly, I don't care enough to do it.
// Lots and lots of type error recovery needs to exist thanks to this fucking bullshit
// anyway, so might as well use raw object types.
//
// [^1]: A message that is incredibly poorly conveyed in the official docs. Thanks,
// Microsoft.
export interface FolderDestination {
  dest: string;
};

export interface SyncSettings {
  full_vault_sync: boolean;
  root_folder: FolderDestination;
  // Thanks, typescript. You're super good at making types reliable
  subfolders: object;
  ignore_workspace: boolean;
};

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  full_vault_sync: true,
  root_folder: {
    dest: ""
  },
  subfolders: {},
  ignore_workspace: true,
};
