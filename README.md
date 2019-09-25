# 3D audio visualizer
Web 3D аudio visualizer written in javascript using three.js with full VR support if available.

#### Online link: https://kikoano.github.io/audio-visualizer/
![](https://github.com/kikoano/audio-visualizer/blob/master/images/audio%20visualizer.png)
![](https://github.com/kikoano/audio-visualizer/blob/master/images/vr%20gui1.gif)
![](https://github.com/kikoano/audio-visualizer/blob/master/images/vr%20gui2.gif)
## Контроли и користење
### GUI
Се користи dat.GUI за сите контроли во апликацијата. GUI е составено од folders: main, global scene и scene. Секој фолдер содржи контроли. Сите контроли работат во реално време за да може да се видат измените веднаш.

![](https://github.com/kikoano/audio-visualizer/blob/master/images/ball%20gui.png)

Има опција да се изберат готови presets вредности за контролите како и можност за снимање на моменталните контроли.

![](https://github.com/kikoano/audio-visualizer/blob/master/images/presets.png)
### Main
![](https://github.com/kikoano/audio-visualizer/blob/master/images/main%20gui.png)

Со контролата Scene се бира сцена(scene) за приказ на аудио визуализација. Има две сцени што може да се изберат Ball и Wave.
Music контролата се бира од дадени 5 готови музики за пример. Current time кажува моменталното време на музиката во минути и секунди. Со клик на копчето Pause/Resume се паузира/продолжува музиката. Со Volume подесуваме јачина на звукот на музиката.

Со Копчето Open custom може да се овори било која музика од компјутерот на корисникот. Custom music name кажува имео на моменталната избрана музика од компјутерот на корисникот(само ако има избрано custom music).
### Global scene
![](https://github.com/kikoano/audio-visualizer/blob/master/images/global%20scene%20gui.png)

FFT size e големината на FFT (Fast Fourier Transform) која ке се користи за да се одреди доменот на фреквенција. Можни вредности се: 256, 512, 1024, 2048. Колку поголема големина на FFT толку повеке работа за CPU.

Background color е избор на позадина боја. Ascii effect го претвара целиот canvas во ascii изглед со симболи ``` .:-+=%@#```. Stats покажува fps во горнио лев агол на екранот. Исто така ќе покажува fps и во VR ако имаме.
### Scene
Овде контролите зависат од избраната сцена Ball и Wave.
#### Ball
![](https://github.com/kikoano/audio-visualizer/blob/master/images/ball%20scene%20gui.png)

Има многу опции како избирање јачина и боја на ambient и spot светлина. Wireframe и flat shading опции за вид на приказ на ball и plane. Има контроли за подесување боја, големина радиус, детал, сјајност, emmisive боја и specular боја на ball. Rotation е брзината на ротација околу y-оска на сите објекти во сцената. Ако е во VR тогаш се ротира само топката околу y-оска. За ball, plane 1 и plane 2 има контроли да се подеси на која фреквенција ќе работат.
#### Wave
![](https://github.com/kikoano/audio-visualizer/blob/master/images/wave%20scene%20gui.png)

Има контроли за подесување на раздвојување, ширина и висина на wave. Wave е составен од particles(честички). Particle 1 се долните particles а, particle 2 се горните particles. Има контроли за избор на боја за Particle 1 и 2. Wave speed е брзината на брановите(оваа брзина е помножена со моментала фреквентна брзина за да не биде константна).
## Краток опис на изработка)
Се користи renderer, camera и clock од three.js. Димензиите на рендерот(canvas екран) димамички се менуваат во зависност ако се resize веб прелистувачот.

Има можност за измена на почетната музика(default music) со query string `music`. Вредности што може да ги добие се од 0 до 4. Пример: `?music=3`. Ако нема нема дефинирано query string тогаш вредноста е 0.

За слушање, процесирање и читање на музика се користат THREE.Audio, THREE.AudioListener, THREE.AudioLoader. Кога ќе заврши музиката одново почнува. За анализирање и зимање фреквенција од музиката во даден момент се кориси THREE.AudioAnalyser. Функцијата updateFrData ја поделува фреквенцијата на музиката на 6 дела(листи): lowerMaxFr, lowerAvgFr, upperMaxFr, upperAvgFr, overallMaxFr, overallAvgFr.

Се користи `renderer.setAnimationLoop(render);` за повторување на целиот циклус за зимање фреквенција во даден момент од музика, update на сцената и исцртување на сцената како и пресметување на fps за stats i statsVR. Од clock се зима делта времето кој се праќа на сцената. Сите движења во сцената се множат со делта времето за да fps може да биде динамичко а не фиксирано на одредена вредност.
### Scene
Scene е класа од која се изведени класите Ball и Wave. При креирање на класата се иницијализира GUI и додава VR код ако уредот подржува VR. При бришење на класата се бришат сите објекти од сцената како и сите GUI контроли наменети за одредена сцена.
#### Ball
Геометријата на plane 1 и plane 2 се направени со THREE.PlaneGeometry додека ball е направен со THREE.IcosahedronGeometry. Објектите користат THREE.MeshPhongMaterial. Three.js во позадина прави Phong shader со соодветни uniforms вредности кои можеме во било кој момент да ги смениме. Mesh za plane 1/2 и ball се прави со геометријата и материјалот.

Се користи 2 вида на светлина ambient(THREE.AmbientLight) и spot(THREE.SpotLight) светлина со дефинирани вредноси кои може да се менуваат со GUI контролерите.

Геометријата на објектите се менува во зависност од фреквенцијата на музиката. Се користи Simplex noise за да се добие мало изобличување на фреквенцијата.
#### Wave
Се користат shaders wave.vert и wave.frag. Со THREE.BufferGeometry(geometry) и THREE.ShaderMaterial(material) се имплементираат shaders во Three.js. Се прави particles и particles2 со `new THREE.Points(geometry, material);`.

Се прави итерација на сите точки во particles и particles2 и се прави бран ефект(wave effect) со помош на фреквенцијата на музиката, Math.sin modulate функцијата. Брзината на движењето на браноот исто така зависи од фреквенцијата на музиката.
## VR поддршка
![](https://github.com/kikoano/audio-visualizer/blob/master/images/vr%20gui3.gif)

На почетокот на кодот се одредува дали уредот има VR подршка. Ако нема подршка тогаш не се користат VR кодовите за да има подобри перформанси.

На стартување на апликацијата се креира контролер кој со помош на three.js добива форма и материјал на ласер. Исто така се креира VR GUI со помош на dat.guiVR кој при креирање на сцената ги креира контролите(исти вредности од GUI). Со контролерот прикажување на ласер во VR се контролираат контролите.

Се користи statsVR за покажување FPS во VR.

![](https://github.com/kikoano/audio-visualizer/blob/master/images/vr%20stats.gif)
## Дополнителни библиотетки
Користени дополнителни библиотеки:
* [three.js](https://github.com/mrdoob/three.js/)
* [simplex-noise.js](https://github.com/jwagner/simplex-noise.js)
* [dat.GUI](https://github.com/dataarts/dat.gui)
* [dat.guiVR](https://github.com/dataarts/dat.guiVR)
* [stats.js](https://github.com/mrdoob/stats.js/)
* [StatsVR](https://github.com/Sean-Bradley/StatsVR)
#### Изработил: Кристијан Трајковски
