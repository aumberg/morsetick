# [MorseTick](http://aumberg.github.io/morsetick/)
```
 _____________________________________________________________ 
|                                                             |
|NAME                                                         |
|     MorseTick - old school, telegraphic audio player        |
|                                                             |
|DESCRIPTION                                                  |
|     MorseTick - old school, telegraphic audio player,       |
|     written in JavaScript, uses Morse code to search music  |
|     in soundcloud (https://soundcloud.com/). Script core can|
|     used in your own application to obtain Morse code power.|
|                                                             |
|INSTALL FOR BROWSERS                                         |
|     Include source "morsetick.js" in <script/> tag.         |
|                                                             |
|INSTALL CONSOLE VERSION                                      |
|     # Install NodeJs, npm and project dependences           |
|       sudo apt-get install nodejs npm                       |
|     && cd /path_to_project_folder                           |
|     && npm install                                          |
|                                                             |
|     # Install SoX (required for single-board computers)     |
|       sudo apt-get install sox                              |
|                                                             |
|     # Start player                                          |
|       node index.js                                         |
|                                                             |
|     # Start with "aplay" and "raw" audio output             |
|       node index.js '{"audio stdout":"raw"}' | aplay -qfcd  |
|                                                             |
|     # With "sox" and "wav"                                  |
|       node index.js '{"audio stdout":"wav"}'| play -qtwav - |
|                                                             |
|     # With "sox" and "mp3" streaming                        |
|       node index.js '{"audio stdout":"wav"}' | cvlc -q -    |
|     --sout '#transcode{acodec=mp3}:standard{access=http,    |
|     mux=raw,dst=localhost:8088}'                            |
|                                                             |
|GET STARTED                                                  |
|     Click in series any alphanumeric key on keyboard        |
|     to search by Morse code or type request in "noob" mode. |
|                                                             |
|COMMANDS                                                     |
|     e - toggle play & pause                                 |
|     e n - Next track                                        |
|     e p - Previous track                                    |
|     e (number) - change track number (from 1 to 100)        |
|     e v - set Volume (from 0 to 9)                          |
|     e l - show listened Links                               |
|     e e (text) - search with "e " at start                  |
|     e h - show this Help                                    |
|                                                             |
|AUTHOR                                                       |
|     Written by Alexander Umberg (slovastick@mail.ru)        |
|                                                             |
|Thanks for all, without who this program never looked like so|
|                                    ...Oh, you are amazing!!!|
|                                                             |
|COPYRIGHT                                                    |
|     Project page - https://github.com/aumberg/morsetick     |
|     License - http://unlicense.org/UNLICENSE                |
|     Manifesto - http://minifesto.org/                       |
|                                                             |
|SEE ALSO                                                     |
|     http://justpaste.it/l8or                                |
|                                                             |
|MORSE CODES                                                  |
| a .-         b -...       c -.-.       d -..                |
| e .          f ..-.       g --.        h ....               |
| i ..         j .---       k -.-        l .-..               |
| m --         n -.         o ---        p .--.               |
| q --.-       r .-.        s ...        t -                  |
| u ..-        v ...-       w .--        x -..-               |
| y -.--       z --..                                         |
|                                                             |
| 1 .----      2 ..---      3 ...--      4 ....-      5 ..... |
| 6 -....      7 --...      8 ---..      9 ----.      0 ----- |
|_____________________________________________________________|
```
### [Try it on GitHub pages!](http://aumberg.github.io/morsetick/)