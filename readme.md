# [MorseTick](http://aumberg.github.io/morsetick/)
```
 _____________________________________________________________ 
|                                                             |
|NAME                                                         |
|     MorseTick - old school, audio player for RaspberryPi    |
|                                                             |
|DESCRIPTION                                                  |
|     MorseTick - old school, audio player for RaspberryPi,   |
|     written in JavaScript. Search can uses Morse code       |
|     in soundcloud (https://soundcloud.com/).                |
\                                                             |
|INSTALL AND RUN                                              |
|       sudo kbdrate -r 20 -d 200                             |
|       sudo apt-get install nodejs npm                       |
|       sudo apt-get install sox                              |
|       sudo apt-get install git                              |
|       git clone https://github.com/aumberg/morsetick        |
|       cd morsetick                                          |
|       npm install                                           |
|       node index.js                                         |
|                                                             |
|INSTALL IN AUTOLOAD                                          |
|   # add command to /etc/rc.local                            |
|   su pi -c '(nice -n 1 node /home/pi/morsetick/index.js &)' |
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
|                        ...Oh, you are amazing and awesome!!!|
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