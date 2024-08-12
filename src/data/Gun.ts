import Gun from 'gun';
import 'gun/sea';


function getGun(options: any) {
    return Gun({
        peers: options.peers || [],
        localStorage: options.localStorage !== false,
        radisk: options.radisk !== false,
        multicast: options.multicast !== false
    });
}


export default getGun;