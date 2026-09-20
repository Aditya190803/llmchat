import { APP_DOMAIN } from '../config/brand';
import Plausible from 'plausible-tracker';

const plausible = Plausible({
    domain: APP_DOMAIN,
});

export { plausible };
