import { Howl } from 'howler'; // Import Howler.js
interface Sounds {
    [key: string]: Howl;
}
const sounds: Sounds = {
    countdown: new Howl({
        src: ['/sounds/countdown.mp3'], // Adjust the path as needed
    }),
    click: new Howl({
        src: ['/sounds/click.mp3'],
    }),
    //... add more sounds as needed
};
export const play = (soundName: string) => {
    if (sounds[soundName]) {
        sounds[soundName].play();
    }
    else {
        console.error(`Sound not found: ${soundName}`);
    }
};
//... other sound-related functions (e.g., stop, volume control)