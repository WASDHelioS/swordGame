
/*
 * Start File:
 * ./framework/engine/game.js
 */ 
class Game
{
    activeScenes = [];
    pendingRemoval = [];

    previousStep = 0; //used for calculating deltaTime

    images = {};

    constructor ()
    {
        this.previousStep = 0;
        this.activeScenes = [];
        this.update = this.update.bind(this);
    }

    startGame ()
    {
        this.update();
        GameInput.g_init();
    }

    preloadImagesThenStart (imageData, onComplete)
    {
        const cont = async () =>
        {
            await this.preloadImages(
                imageData
            );

            this.startGame();
            onComplete && onComplete();
        };

        cont.apply();
    }

    setPrimaryScene (scene)
    {
        if (this.activeScenes.contains(scene))
        {
            for (let i = 0; i < this.activeScenes.length; i++)
                this.activeScenes[i].g_primary = false;

            scene.g_primary = true;
        }
    }

    async preloadImages (imagesData)
    {
        const promises = [];
        const context = this;
        console.log(imagesData);

        for (var imageData of imagesData)
        {
            if (context.images[imageData.name])
            {
                console.warn("Image '" + imageData.name + "' is already loaded! (overwriting anyway)");
            }

            promises.push(new Promise(resolve =>
            {
                var img = new Image();
                var imageContext = { name: imageData.name, subImgTotal: imageData.subImgTotal, perRow: imageData.perRow, loop: imageData.loop, chain: imageData.chain };

                img.onload = function ()
                {

                    var finalImage = new image(img, imageContext.subImgTotal, imageContext.perRow);

                    context.images[imageContext.name] = finalImage;

                    resolve();
                };

                img.src = imageData.url;
                img.setAttribute("style", "display:none");
            }));
        }
        await Promise.all(promises);

        console.log("all images loaded");

        return this.images;
    }

    loadScene (scene)
    {
        if (this.activeScenes.length == 0)
            scene.g_primary = true;

        this.activeScenes.push(scene);
        scene.game = this;
        scene.onLoad();
    }

    removeScene (scene)
    {
        let index = this.activeScenes.indexOf(scene);
        if (index >= 0 && !scene.destroyed)
        {
            if (!this.pendingRemoval.contains(index))
                this.pendingRemoval.push(index);
        }
    }

    update ()
    {
        this.previousStep = this.previousStep || 0;
        let stepTime = Date.now();
        let stepTimeCurr = (stepTime - this.previousStep) * 0.001;
        stepTimeCurr = Math.min(stepTimeCurr, 0.1);
        if (isNaN(stepTimeCurr))
            stepTimeCurr = 0;

        GameInput.g_updateKeys();

        for (let i = 0; i < this.activeScenes.length; i++)
        {
            this.activeScenes[i].update(stepTimeCurr);
            this.activeScenes[i].draw();
        }

        this.cleanActiveScenes();

        this.previousStep = stepTime;

        TWEEN.update();

        requestAnimationFrame(this.update);
    }

    cleanActiveScenes ()
    {
        if (this.pendingRemoval.length > 0)
        {
            this.pendingRemoval.sort((a, b) => a - b);

            for (let i = this.pendingRemoval.length - 1; i >= 0; i--)
            {
                if (this.activeScenes[this.pendingRemoval[i]].destroyed)
                    this.activeScenes.removeAt(this.pendingRemoval[i]);

                this.pendingRemoval.splice(i, 1);
            }
        }
    }
}
/*
 * End File:
 * ./framework/engine/game.js
 */ 

/*
 * Start File:
 * ./framework/engine/gameobject.js
 */ 
class GameObject
{
    transform = null;
    renderer = null;
    collider = null;
    scene = null;

    destroyed = false;

    constructor (x, y, sprite, layer)
    {
        this.transform = new Transform(this, x, y, 1, 1, 0);
        this.renderer = new Renderer(this, sprite);
        this.collider = new Collider(this);
    }

    update (deltaTime)
    {
        this.transform.update(deltaTime);
        this.collider.update(deltaTime);
        this.renderer.update(deltaTime);
    }

    destroy ()
    {
        if (!this.destroyed)
        {
            this.onDestroy && this.onDestroy();

            this.scene.removeObject(this);
            this.destroyed = true;
        }
    }

    draw ()
    {
        this.renderer.draw();
    }
}
/*
 * End File:
 * ./framework/engine/gameobject.js
 */ 

/*
 * Start File:
 * ./framework/engine/image.js
 */ 
class image
{
	subImages = null;
	subImagesPerRow = null;
	loop = false;
	chain = null;

	g_image = null;

	animationCycles = {};

	constructor (image, subImgTotal = 1, perRow = 1, loop = false, chain = null)
	{
		subImgTotal = subImgTotal || 1;
		perRow = perRow || 1;

		this.subImages = subImgTotal;
		this.subImagesPerRow = perRow;
		this.g_image = image;
		this.loop = loop;
		this.chain = chain;

		this.cacheWidth = -1;
		this.cacheHeight = -1;

		image.id = "loadedImage";
		document.body.append(image);
		console.log("Image loaded: " + image.src);
	}

	draw (scene, dx, dy, dw, dh, rotation, mirrorX, mirrorY, alpha, subImage)
	{
		var shouldDraw = true;

		if (dx < -Math.sqrt(Math.pow(dw, 2) + Math.pow(dh, 2)))
			shouldDraw = false;

		if (dy < -Math.sqrt(Math.pow(dw, 2) + Math.pow(dh, 2)))
			shouldDraw = false;

		if (dx > scene.real_size.x + Math.sqrt(Math.pow(dw, 2) + Math.pow(dh, 2)))
			shouldDraw = false;

		if (dy > scene.real_size.y + Math.sqrt(Math.pow(dw, 2) + Math.pow(dh, 2)))
			shouldDraw = false;

		if (shouldDraw)
		{
			var context = scene.context;
			context.save();
			var oldAlpha = context.globalAlpha;
			context.globalAlpha = alpha;

			context.translate(dx, dy);
			context.rotate(rotation * (Math.PI / 180));

			(mirrorX || mirrorY) && context.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);

			var subImageData = this.getSubImage(subImage);

			context.drawImage(this.g_image, subImageData.sx, subImageData.sy, subImageData.sw, subImageData.sh, -dw / 2, -dh / 2, dw, dh);

			context.restore();
			context.globalAlpha = oldAlpha;
		}
	}

	addAnimationCycle (label, cycle, loop, chain, chainDefaultIndex, chainSpeed) 
	{
		this.animationCycles[label] =
		{
			frames: cycle,
			loop: loop,
			chain: chain,
			chainDefaultIndex: chainDefaultIndex,
			chainSpeed: chainSpeed
		};
	}

	get width () 
	{
		if (this.cacheWidth < 0)
			this.cacheWidth = this.g_image.width / this.subImagesPerRow;

		return this.cacheWidth;
	}

	get height () 
	{
		if (this.cacheHeight < 0)
			this.cacheHeight = this.g_image.height / (Math.ceil(this.subImages / this.subImagesPerRow) + 0);

		return this.cacheHeight;
	}

	cacheWidth = -1;
	cacheHeight = -1;

	getSubImage (subImageIndex) 
	{
		var subImage = Math.round(subImageIndex);
		subImage %= this.subImages;

		var c = subImage % this.subImagesPerRow;
		var r = Math.floor(subImage / this.subImagesPerRow);
		var sw = (this.g_image.width / this.subImagesPerRow);
		var sh = (this.g_image.height / Math.ceil(this.subImages / this.subImagesPerRow));
		var sx = sw * c;
		var sy = sh * r;

		return { sw: sw, sh: sh, sx: sx, sy: sy };
	}
}
/*
 * End File:
 * ./framework/engine/image.js
 */ 

/*
 * Start File:
 * ./framework/engine/objectComponents/collider.js
 */ 
class Collider
{
    gameObject = null;
    enabled = false;

    constructor (gameObject)
    {
        this.gameObject = gameObject;
    }

    get widestDiagonal ()
    {
        return Math.sqrt((this.gameObject.transform.size.x * this.gameObject.transform.size.x) + (this.gameObject.transform.size.y * this.gameObject.transform.size.y));
    }

    update (deltaTime)
    {
        if (this.enabled)
        {
            this.checkCollisions();
        }

        let pressed = GameInput.mousePressed();
        let held = GameInput.mouseHeld();

        if (pressed.left || pressed.middle || pressed.right)
        {
            this.checkClick(true, pressed);
        }

        if (held.left || held.middle || held.right)
        {
            this.checkClick(false, held);
        }
    }

    checkClick (thisFrame, btns)
    {
        var hit = false;
        var clickPos = GameInput.mousePosition.subtract(this.gameObject.scene.position).subtract(this.gameObject.scene.cameraPosition);

        var hw = this.gameObject.transform.size.x / 2;
        var hh = this.gameObject.transform.size.y / 2;

        if (clickPos.x > this.gameObject.transform.position.x - hw && clickPos.x < this.gameObject.transform.position.x + hw)
        {
            if (clickPos.y > this.gameObject.transform.position.y - hh && clickPos.y < this.gameObject.transform.position.y + hh)
            {
                hit = true;
            }
        }

        if (hit)
        {
            if (thisFrame)
            {
                this.gameObject.onClick && this.gameObject.onClick(btns);
            }
            else
            {
                this.gameObject.onMouseHeld && this.gameObject.onMouseHeld(btns);
            }
        }
    }

    isInBounds (point)
    {
        var hw = this.gameObject.transform.size.x / 2;
        var hh = this.gameObject.transform.size.y / 2;

        if (point.x > this.gameObject.transform.position.x - hw && point.x < this.gameObject.transform.position.x + hw)
        {
            if (point.y > this.gameObject.transform.position.y - hh && point.y < this.gameObject.transform.position.y + hh)
            {
                return true;
            }
        }

        return false;
    }

    checkCollisions ()
    {
        if (this.enabled && !this.gameObject.destroyed)
        {
            let offset = this.gameObject.scene.activeObjects.indexOf(this) + 1;

            for (var i = offset; i < this.gameObject.scene.activeObjects.length; i++)
            {
                if (this.gameObject.scene.activeObjects[i] != this && this.gameObject.scene.activeObjects[i].collider.enabled)
                {
                    if (this.widestDiagonal + this.gameObject.scene.activeObjects[i].collider.widestDiagonal < this.gameObject.transform.position.distanceTo(this.gameObject.scene.activeObjects[i].transform.position))
                        continue;

                    var hit = false;
                    var o2 = this.gameObject.scene.activeObjects[i];

                    //hw = halfWidth, hh = halfHeight
                    var hw = this.gameObject.transform.size.x / 2;
                    var hh = this.gameObject.transform.size.y / 2;

                    var ohw = o2.transform.size.x / 2;
                    var ohh = o2.transform.size.y / 2;

                    //CHECK FROM OBJ PERSPECTIVE
                    var points =
                        [
                            this.gameObject.transform.position.x - hw,
                            this.gameObject.transform.position.x + hw,
                            this.gameObject.transform.position.y - hh,
                            this.gameObject.transform.position.y + hh
                        ];

                    if (points[1] >= o2.transform.position.x - ohw && points[0] <= o2.transform.position.x + ohw)
                    {
                        if (points[3] >= o2.transform.position.y - ohh && points[2] <= o2.transform.position.y + ohh)
                        {
                            hit = true;
                        }
                    }

                    if (hit)
                        if (!this.gameObject.destroyed && typeof this.gameObject.onCollision == 'function') { this.gameObject.onCollision(o2); }
                }
            }
        }
    }
}
/*
 * End File:
 * ./framework/engine/objectComponents/collider.js
 */ 

/*
 * Start File:
 * ./framework/engine/objectComponents/renderer.js
 */ 
class Renderer
{
    sprite = null;
    gameObject = null;
    subImage = 0;
    alpha = 1;
    mirrorX = false;
    mirrorY = false;

    defaultAnimationSpeed = 1;

    cycle = null;

    visible = true;

    constructor (parentObject, sprite)
    {
        this.gameObject = parentObject;
        this.sprite = sprite;
    }

    update (deltaTime) 
    {
        if (this.cycle) 
        {
            if (!this.cycle.cycleSpeed || this.cycle.cycleSpeed == -1) 
            {
                this.subImage = this.cycle.cycleArray[this.cycle.default];
                this.cycle.current = this.cycle.default;
                return;
            }
            this.cycle.timer += deltaTime;

            if (this.cycle.timer > this.cycle.cycleSpeed) 
            {
                this.cycle.timer -= this.cycle.cycleSpeed;
                let next;

                if (this.cycle.loop)
                {
                    next = (this.cycle.current + 1) % this.cycle.cycleArray.length;
                }
                else
                {
                    if (this.cycle.current + 1 > this.cycle.cycleArray.length)
                    {
                        if (this.cycle.chain)
                        {
                            this.cycle.chainDefaultIndex = this.cycle.chainDefaultIndex || this.cycle.default;
                            this.cycle.chainSpeed = this.cycle.chainSpeed || this.cycle.cycleSpeed;
                            this.setAnimation(this.cycle.chain, this.cycle.chainDefaultIndex, this.cycle.chainSpeed);
                        }

                        return;
                    }
                    else
                    {
                        next = this.cycle.current + 1;
                    }
                }

                this.updateCycleSprite(next);
            }
        }
    }

    updateCycleSprite (index)
    {
        this.subImage = this.cycle.cycleArray[index];
        this.cycle.current = index;
    }

    draw ()
    {
        if (this.sprite)
        {
            var offX = this.gameObject.scene.cameraPosition.x;
            var offY = this.gameObject.scene.cameraPosition.y;

            this.drawSprite(this.gameObject.transform.position.x + offX,
                this.gameObject.transform.position.y + offY,
                this.gameObject.transform.size.x,
                this.gameObject.transform.size.y,
                this.gameObject.transform.rotation);
        }
    }

    drawSprite ()
    {
        if (isNaN(this.subImage))
        {
            this.subImage = this.g_subImgOld;
        }
        else
        {
            this.g_subImgOld = this.subImage;
        }

        this.sprite.draw(
            this.gameObject.scene,
            Math.round(this.gameObject.transform.position.x),
            Math.round(this.gameObject.transform.position.y),
            this.gameObject.transform.size.x,
            this.gameObject.transform.size.y,
            this.gameObject.transform.rotation,
            this.mirrorX,
            this.mirrorY,
            this.alpha,
            this.subImage
        );
    }

    get currentAnimationName ()
    {
        return this.cycle ? this.cycle.label : null;
    }

    setAnimation (label, defaultIndex = 0, cycleSpeed = -1) 
    {
        if (cycleSpeed < 0)
        {
            cycleSpeed = this.defaultAnimationSpeed;
        }

        if (this.cycle) 
        {
            if (this.cycle.label == label) 
            {
                this.cycle.defaultIndex = defaultIndex;
                this.cycle.cycleSpeed = cycleSpeed;
                return;
            }
        }

        let cycleData = this.sprite.animationCycles[label];

        this.cycle = {
            label: label,
            cycleArray: cycleData.frames,
            default: defaultIndex,
            current: defaultIndex,
            cycleSpeed: cycleSpeed,
            loop: cycleData.loop,
            chain: cycleData.chain,
            chainDefaultIndex: cycleData.chainDefaultIndex,
            chainSpeed: cycleData.chainSpeed,
            timer: 0
        };

        this.subImage = this.cycle.cycleArray[this.cycle.current];
    }

    setAnimationCycleSpeed (cycleSpeed) 
    {
        if (this.cycle) 
        {
            this.cycle.cycleSpeed = cycleSpeed;
        }
    }

    setSubImage (subImage) 
    {
        this.subImage = subImage;
        this.cycle = null;
    }
}
/*
 * End File:
 * ./framework/engine/objectComponents/renderer.js
 */ 

/*
 * Start File:
 * ./framework/engine/objectComponents/transform.js
 */ 
class Transform
{
    get position ()
    {
        if (!this.g_position)
            this.g_position = new vector(0, 0);

        return this.g_position;
    }

    set position (v)
    {
        if (!this.g_position)
            this.g_position = new vector(v.x, v.y);

        this.g_position.x = v.x;
        this.g_position.y = v.y;
    }

    get scale ()
    {
        if (!this.g_scale)
            this.g_scale = new vector(0, 0);

        return this.g_scale;
    }

    set scale (v)
    {
        if (!this.g_scale)
            this.g_scale = new vector(v.x, v.y);

        this.g_scale.x = v.x;
        this.g_scale.y = v.y;
    }

    get velocity ()
    {
        if (!this.g_velocity)
            this.g_velocity = new vector(0, 0);

        return this.g_velocity;
    }

    set velocity (v)
    {
        if (!this.g_velocity)
            this.g_velocity = new vector(v.x, v.y);

        this.g_velocity.x = v.x;
        this.g_velocity.y = v.y;
    }

    g_position = null;

    g_scale = null;
    rotation = 0;
    gameObject = null;

    g_velocity = null;
    angularVelocity = 0;

    get size ()
    {
        return new vector(
            this.scale.x * this.gameObject.renderer.sprite.width,
            this.scale.y * this.gameObject.renderer.sprite.height);
    }

    constructor (gameObject, x, y, w, h, r)
    {
        this.gameObject = gameObject;
        this.position = new vector(x, y);
        this.scale = new vector(w, h);
        this.rotation = r;

        this.velocity = new vector(0, 0);
    }

    update (deltaTime)
    {
        this.position = this.position.add(this.velocity.stretch(deltaTime));
        this.rotation += this.angularVelocity * deltaTime;
    }

    pointTowards (point)
    {
        var delta = point.subtract(this.position);

        this.rotation = delta.toAngle();
    }

    left ()
    {
        return this.g_dir(0);
    }

    right ()
    {
        return this.g_dir(180);
    }

    forward ()
    {
        return this.g_dir(90);
    }

    back ()
    {
        return this.g_dir(270);
    }

    g_dir (offset)
    {
        var myAngleInRadians = (this.rotation + offset) * (Math.PI / 180);

        return angleVector = new vector(-Math.cos(myAngleInRadians), -Math.sin(myAngleInRadians));
    }
}
/*
 * End File:
 * ./framework/engine/objectComponents/transform.js
 */ 

/*
 * Start File:
 * ./framework/engine/scene.js
 */ 
class Scene
{
    static idCount = 0;
    id = null;
    activeObjects = [];
    position = null;
    size = null;
    real_position = null;
    px = 0; py = 0;
    real_size = null;
    cameraPosition = null;
    parentScene = null;
    renderBackground = true;

    pendingRemoval = [];

    g_primary = false;

    static DisplayModes = { absolute: 0, relativeToParent: 1 };

    displayMode = Scene.DisplayModes.absolute;

    cv_canvas = null;
    cv_context = null;
    destroyed = false;

    game = null;

    get primary ()
    {
        return this.g_primary;
    }

    constructor (x, y, width, height, displayMode = 0)
    {
        Scene.idCount++;
        this.id = 'canvas_' + Scene.idCount;

        this.position = new vector(x, y);
        this.size = new vector(width, height);
        this.real_position = new vector(x, y);
        this.real_size = new vector(width, height);
        this.cameraPosition = new vector(0, 0);
        this.displayMode = displayMode;

        let body = document.body;

        body.insertAdjacentHTML('beforeend', '<canvas id="' + this.id + '" style="position: absolute; left: ' + x + 'px; top: ' + y + 'px;" width="' + width + '" height="' + height + '"></canvas>');

        this.cv_canvas = document.getElementById(this.id);
        this.cv_context = this.cv_canvas.getContext('2d');
    }

    setPrimary ()
    {
        this.game.setPrimaryScene(this);
    }

    onLoad ()
    {

    }

    loadChildScene (scene)
    {
        scene.parentScene = this;
        this.game.loadScene(scene);
    }

    destroy ()
    {
        if (!this.destroyed)
        {
            for (var i = 0; i < this.activeObjects.length; i++)
            {
                this.activeObjects[i].destroy();
            }
            this.game.removeScene(this);

            this.context.clearRect(0, 0, this.real_size.x, this.real_size.y);

            this.destroyed = true;
        }
    }

    backgroundColor =
        {
            r: 255,
            g: 255,
            b: 255
        };

    get canvas ()
    {
        return this.cv_canvas;
    }

    get context ()
    {
        return this.cv_context;
    }

    addObject (obj)
    {
        if (this.destroyed)
            return;

        this.activeObjects.push(obj);
        obj.scene = this;

        obj.addedToScene && obj.addedToScene();

        return obj;
    }

    removeObject (obj)
    {
        let index = this.activeObjects.indexOf(obj);
        if (index >= 0 && !obj.destroyed)
        {
            if (!this.pendingRemoval.contains(index))
                this.pendingRemoval.push(index);
        }
    }

    update (deltaTime)
    {
        for (let i = 0; i < this.activeObjects.length; i++)
        {
            this.activeObjects[i].update(deltaTime);
        }

        if (this.pendingRemoval.length)
        {
            this.pendingRemoval.sort((a, b) => a - b);

            for (let i = this.pendingRemoval.length - 1; i >= 0; i--) 
            {
                if (this.activeObjects[this.pendingRemoval[i]].destroyed)
                    this.activeObjects.removeAt(this.pendingRemoval[i]);

                this.pendingRemoval.splice(i, 1);
            }
        }
    }

    draw ()
    {
        if (this.destroyed)
            return;

        if (this.displayMode == Scene.DisplayModes.relativeToParent)
        {
            if (this.parentScene)
            {
                this.real_position.x = this.parentScene.real_position.x + (this.position.x * this.parentScene.real_size.x);
                this.real_position.y = this.parentScene.real_position.y + (this.position.y * this.parentScene.real_size.y);

                this.real_size.x = this.parentScene.real_size.x * this.size.x;
                this.real_size.y = this.parentScene.real_size.y * this.size.y;
            }
            else
            {
                this.real_position.x = window.innerWidth * this.position.x;
                this.real_position.y = window.innerHeight * this.position.y;

                this.real_size.x = window.innerWidth * this.size.x;
                this.real_size.y = window.innerHeight * this.size.y;
            }
        }
        else if (this.displayMode == Scene.DisplayModes.absolute)
        {
            this.real_position.x = this.position.x;
            this.real_position.y = this.position.y;

            this.real_size.x = this.size.x;
            this.real_size.y = this.size.y;
        }

        if (this.canvas.width != this.real_size.x)
            this.canvas.width = this.real_size.x;

        if (this.canvas.height != this.real_size.y)
            this.canvas.height = this.real_size.y;

        if (this.px != this.real_position.x)
        {
            this.px = this.real_position.x;
            this.canvas.style.left = this.real_position.x;
        }

        if (this.py != this.real_position.y)
        {
            this.py = this.real_position.y;
            this.canvas.style.top = this.real_position.y;
        }

        if (this.renderBackground)
        {
            this.context.fillStyle = "rgb(" + this.backgroundColor.r + "," + this.backgroundColor.g + "," + this.backgroundColor.b + ")"; // sets the color to fill in the rectangle with
            this.context.fillRect(0, 0, this.real_size.x, this.real_size.y);
        }
        else 
        {
            this.context.clearRect(0, 0, this.real_size.x, this.real_size.y);
        }

        for (var i = 0; i < this.activeObjects.length; i++)
        {
            if (!this.activeObjects[i].destroyed && this.activeObjects[i].renderer.visible)
                this.activeObjects[i].draw(this.context);
        }
    }
}
/*
 * End File:
 * ./framework/engine/scene.js
 */ 

/*
 * Start File:
 * ./framework/extensions/extentions.js
 */ 
/**
 * Extending exising functionality
 */

Array.prototype.remove = function (element)
{
    var index = this.indexOf(element);

    if (index > -1)
    {
        this.splice(index, 1);
    }
    else
    {
        console.error("Element not part of array!", this, element);
    }
};

Array.prototype.removeAt = function (index)
{
    if (index > -1)
    {
        this.splice(index, 1);
    }
};

Array.prototype.contains = function (element)
{
    var index = this.indexOf(element);

    return index > -1;
};

Math.clamp = function (number, min, max)
{
    return Math.min(max, Math.max(min, number));
};

Math.randomRange = function (min, max)
{
    return min + (Math.random() * (max - min));
};

Math.lerp = function (a, b, t)
{
    return a + (b - a) * t;
};

Array.prototype.random = function ()
{
    return this[Math.floor((Math.random() * this.length))];
};
/*
 * End File:
 * ./framework/extensions/extentions.js
 */ 

/*
 * Start File:
 * ./framework/extensions/polyfills.js
 */ 
if (!Math.sign)
{
  Math.sign = function (x)
  {
    x = +x; // convert to a number
    if (x === 0 || isNaN(x))
    {
      return Number(x);
    }
    return x > 0 ? 1 : -1;
  };
}

(function (e) { var t = function () { try { return !!Symbol.iterator; } catch (e) { return false; } }; var n = t(); var r = function (e) { var t = { next: function () { var t = e.shift(); return { done: t === void 0, value: t }; } }; if (n) { t[Symbol.iterator] = function () { return t; }; } return t; }; var i = function (e) { return encodeURIComponent(e).replace(/%20/g, "+"); }; var o = function (e) { return decodeURIComponent(e).replace(/\+/g, " "); }; var a = function () { var t = function (e) { Object.defineProperty(this, "_entries", { value: {} }); if (typeof e === "string") { if (e !== "") { e = e.replace(/^\?/, ""); var n = e.split("&"); var r; for (var i = 0; i < n.length; i++) { r = n[i].split("="); this.append(o(r[0]), r.length > 1 ? o(r[1]) : ""); } } } else if (e instanceof t) { var a = this; e.forEach(function (e, t) { a.append(e, t); }); } }; var a = t.prototype; a.append = function (e, t) { if (e in this._entries) { this._entries[e].push(t.toString()); } else { this._entries[e] = [t.toString()]; } }; a.delete = function (e) { delete this._entries[e]; }; a.get = function (e) { return e in this._entries ? this._entries[e][0] : null; }; a.getAll = function (e) { return e in this._entries ? this._entries[e].slice(0) : []; }; a.has = function (e) { return e in this._entries; }; a.set = function (e, t) { this._entries[e] = [t.toString()]; }; a.forEach = function (e, t) { var n; for (var r in this._entries) { if (this._entries.hasOwnProperty(r)) { n = this._entries[r]; for (var i = 0; i < n.length; i++) { e.call(t, n[i], r, this); } } } }; a.keys = function () { var e = []; this.forEach(function (t, n) { e.push(n); }); return r(e); }; a.values = function () { var e = []; this.forEach(function (t) { e.push(t); }); return r(e); }; a.entries = function () { var e = []; this.forEach(function (t, n) { e.push([n, t]); }); return r(e); }; if (n) { a[Symbol.iterator] = a.entries; } a.toString = function () { var e = []; this.forEach(function (t, n) { e.push(i(n) + "=" + i(t)); }); return e.join("&"); }; e.URLSearchParams = t; }; if (!("URLSearchParams" in e) || new URLSearchParams("?a=1").toString() !== "a=1") { a(); } })(typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this); (function (e) { var t = function () { try { var e = new URL("b", "http://a"); e.pathname = "c%20d"; return e.href === "http://a/c%20d" && e.searchParams; } catch (e) { return false; } }; var n = function () { var t = e.URL; var n = function (e, t) { if (typeof e !== "string") e = String(e); var n = document.implementation.createHTMLDocument(""); window.doc = n; if (t) { var r = n.createElement("base"); r.href = t; n.head.appendChild(r); } var i = n.createElement("a"); i.href = e; n.body.appendChild(i); i.href = i.href; if (i.protocol === ":" || !/:/.test(i.href)) { throw new TypeError("Invalid URL"); } Object.defineProperty(this, "_anchorElement", { value: i }); }; var r = n.prototype; var i = function (e) { Object.defineProperty(r, e, { get: function () { return this._anchorElement[e]; }, set: function (t) { this._anchorElement[e] = t; }, enumerable: true }); };["hash", "host", "hostname", "port", "protocol", "search"].forEach(function (e) { i(e); }); Object.defineProperties(r, { toString: { get: function () { var e = this; return function () { return e.href; }; } }, href: { get: function () { return this._anchorElement.href.replace(/\?$/, ""); }, set: function (e) { this._anchorElement.href = e; }, enumerable: true }, pathname: { get: function () { return this._anchorElement.pathname.replace(/(^\/?)/, "/"); }, set: function (e) { this._anchorElement.pathname = e; }, enumerable: true }, origin: { get: function () { var e = { "http:": 80, "https:": 443, "ftp:": 21 }[this._anchorElement.protocol]; var t = this._anchorElement.port != e && this._anchorElement.port !== ""; return this._anchorElement.protocol + "//" + this._anchorElement.hostname + (t ? ":" + this._anchorElement.port : ""); }, enumerable: true }, password: { get: function () { return ""; }, set: function (e) { }, enumerable: true }, username: { get: function () { return ""; }, set: function (e) { }, enumerable: true }, searchParams: { get: function () { var e = new URLSearchParams(this.search); var t = this;["append", "delete", "set"].forEach(function (n) { var r = e[n]; e[n] = function () { r.apply(e, arguments); t.search = e.toString(); }; }); return e; }, enumerable: true } }); n.createObjectURL = function (e) { return t.createObjectURL.apply(t, arguments); }; n.revokeObjectURL = function (e) { return t.revokeObjectURL.apply(t, arguments); }; e.URL = n; }; if (!t()) { n(); } if (e.location !== void 0 && !("origin" in e.location)) { var r = function () { return e.location.protocol + "//" + e.location.hostname + (e.location.port ? ":" + e.location.port : ""); }; try { Object.defineProperty(e.location, "origin", { get: r, enumerable: true }); } catch (t) { setInterval(function () { e.location.origin = r(); }, 100); } } })(typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this);
/*
 * End File:
 * ./framework/extensions/polyfills.js
 */ 

/*
 * Start File:
 * ./framework/extensions/thirdparty.js
 */ 
/*! jQuery v2.1.3 | (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license */
!function (a, b) { "object" == typeof module && "object" == typeof module.exports ? module.exports = a.document ? b(a, !0) : function (a) { if (!a.document) throw new Error("jQuery requires a window with a document"); return b(a); } : b(a); }("undefined" != typeof window ? window : this, function (a, b)
{
    var c = [], d = c.slice, e = c.concat, f = c.push, g = c.indexOf, h = {}, i = h.toString, j = h.hasOwnProperty, k = {}, l = a.document, m = "2.1.3", n = function (a, b) { return new n.fn.init(a, b); }, o = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, p = /^-ms-/, q = /-([\da-z])/gi, r = function (a, b) { return b.toUpperCase(); }; n.fn = n.prototype = { jquery: m, constructor: n, selector: "", length: 0, toArray: function () { return d.call(this); }, get: function (a) { return null != a ? 0 > a ? this[a + this.length] : this[a] : d.call(this); }, pushStack: function (a) { var b = n.merge(this.constructor(), a); return b.prevObject = this, b.context = this.context, b; }, each: function (a, b) { return n.each(this, a, b); }, map: function (a) { return this.pushStack(n.map(this, function (b, c) { return a.call(b, c, b); })); }, slice: function () { return this.pushStack(d.apply(this, arguments)); }, first: function () { return this.eq(0); }, last: function () { return this.eq(-1); }, eq: function (a) { var b = this.length, c = +a + (0 > a ? b : 0); return this.pushStack(c >= 0 && b > c ? [this[c]] : []); }, end: function () { return this.prevObject || this.constructor(null); }, push: f, sort: c.sort, splice: c.splice }, n.extend = n.fn.extend = function () { var a, b, c, d, e, f, g = arguments[0] || {}, h = 1, i = arguments.length, j = !1; for ("boolean" == typeof g && (j = g, g = arguments[h] || {}, h++), "object" == typeof g || n.isFunction(g) || (g = {}), h === i && (g = this, h--); i > h; h++)if (null != (a = arguments[h])) for (b in a) c = g[b], d = a[b], g !== d && (j && d && (n.isPlainObject(d) || (e = n.isArray(d))) ? (e ? (e = !1, f = c && n.isArray(c) ? c : []) : f = c && n.isPlainObject(c) ? c : {}, g[b] = n.extend(j, f, d)) : void 0 !== d && (g[b] = d)); return g; }, n.extend({ expando: "jQuery" + (m + Math.random()).replace(/\D/g, ""), isReady: !0, error: function (a) { throw new Error(a); }, noop: function () { }, isFunction: function (a) { return "function" === n.type(a); }, isArray: Array.isArray, isWindow: function (a) { return null != a && a === a.window; }, isNumeric: function (a) { return !n.isArray(a) && a - parseFloat(a) + 1 >= 0; }, isPlainObject: function (a) { return "object" !== n.type(a) || a.nodeType || n.isWindow(a) ? !1 : a.constructor && !j.call(a.constructor.prototype, "isPrototypeOf") ? !1 : !0; }, isEmptyObject: function (a) { var b; for (b in a) return !1; return !0; }, type: function (a) { return null == a ? a + "" : "object" == typeof a || "function" == typeof a ? h[i.call(a)] || "object" : typeof a; }, globalEval: function (a) { var b, c = eval; a = n.trim(a), a && (1 === a.indexOf("use strict") ? (b = l.createElement("script"), b.text = a, l.head.appendChild(b).parentNode.removeChild(b)) : c(a)); }, camelCase: function (a) { return a.replace(p, "ms-").replace(q, r); }, nodeName: function (a, b) { return a.nodeName && a.nodeName.toLowerCase() === b.toLowerCase(); }, each: function (a, b, c) { var d, e = 0, f = a.length, g = s(a); if (c) { if (g) { for (; f > e; e++)if (d = b.apply(a[e], c), d === !1) break; } else for (e in a) if (d = b.apply(a[e], c), d === !1) break; } else if (g) { for (; f > e; e++)if (d = b.call(a[e], e, a[e]), d === !1) break; } else for (e in a) if (d = b.call(a[e], e, a[e]), d === !1) break; return a; }, trim: function (a) { return null == a ? "" : (a + "").replace(o, ""); }, makeArray: function (a, b) { var c = b || []; return null != a && (s(Object(a)) ? n.merge(c, "string" == typeof a ? [a] : a) : f.call(c, a)), c; }, inArray: function (a, b, c) { return null == b ? -1 : g.call(b, a, c); }, merge: function (a, b) { for (var c = +b.length, d = 0, e = a.length; c > d; d++)a[e++] = b[d]; return a.length = e, a; }, grep: function (a, b, c) { for (var d, e = [], f = 0, g = a.length, h = !c; g > f; f++)d = !b(a[f], f), d !== h && e.push(a[f]); return e; }, map: function (a, b, c) { var d, f = 0, g = a.length, h = s(a), i = []; if (h) for (; g > f; f++)d = b(a[f], f, c), null != d && i.push(d); else for (f in a) d = b(a[f], f, c), null != d && i.push(d); return e.apply([], i); }, guid: 1, proxy: function (a, b) { var c, e, f; return "string" == typeof b && (c = a[b], b = a, a = c), n.isFunction(a) ? (e = d.call(arguments, 2), f = function () { return a.apply(b || this, e.concat(d.call(arguments))); }, f.guid = a.guid = a.guid || n.guid++, f) : void 0; }, now: Date.now, support: k }), n.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function (a, b) { h["[object " + b + "]"] = b.toLowerCase(); }); function s (a) { var b = a.length, c = n.type(a); return "function" === c || n.isWindow(a) ? !1 : 1 === a.nodeType && b ? !0 : "array" === c || 0 === b || "number" == typeof b && b > 0 && b - 1 in a; } var t = function (a) { var b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u = "sizzle" + 1 * new Date, v = a.document, w = 0, x = 0, y = hb(), z = hb(), A = hb(), B = function (a, b) { return a === b && (l = !0), 0; }, C = 1 << 31, D = {}.hasOwnProperty, E = [], F = E.pop, G = E.push, H = E.push, I = E.slice, J = function (a, b) { for (var c = 0, d = a.length; d > c; c++)if (a[c] === b) return c; return -1; }, K = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped", L = "[\\x20\\t\\r\\n\\f]", M = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+", N = M.replace("w", "w#"), O = "\\[" + L + "*(" + M + ")(?:" + L + "*([*^$|!~]?=)" + L + "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + N + "))|)" + L + "*\\]", P = ":(" + M + ")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|" + O + ")*)|.*)\\)|)", Q = new RegExp(L + "+", "g"), R = new RegExp("^" + L + "+|((?:^|[^\\\\])(?:\\\\.)*)" + L + "+$", "g"), S = new RegExp("^" + L + "*," + L + "*"), T = new RegExp("^" + L + "*([>+~]|" + L + ")" + L + "*"), U = new RegExp("=" + L + "*([^\\]'\"]*?)" + L + "*\\]", "g"), V = new RegExp(P), W = new RegExp("^" + N + "$"), X = { ID: new RegExp("^#(" + M + ")"), CLASS: new RegExp("^\\.(" + M + ")"), TAG: new RegExp("^(" + M.replace("w", "w*") + ")"), ATTR: new RegExp("^" + O), PSEUDO: new RegExp("^" + P), CHILD: new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + L + "*(even|odd|(([+-]|)(\\d*)n|)" + L + "*(?:([+-]|)" + L + "*(\\d+)|))" + L + "*\\)|)", "i"), bool: new RegExp("^(?:" + K + ")$", "i"), needsContext: new RegExp("^" + L + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + L + "*((?:-\\d)?\\d*)" + L + "*\\)|)(?=[^-]|$)", "i") }, Y = /^(?:input|select|textarea|button)$/i, Z = /^h\d$/i, $ = /^[^{]+\{\s*\[native \w/, _ = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/, ab = /[+~]/, bb = /'|\\/g, cb = new RegExp("\\\\([\\da-f]{1,6}" + L + "?|(" + L + ")|.)", "ig"), db = function (a, b, c) { var d = "0x" + b - 65536; return d !== d || c ? b : 0 > d ? String.fromCharCode(d + 65536) : String.fromCharCode(d >> 10 | 55296, 1023 & d | 56320); }, eb = function () { m(); }; try { H.apply(E = I.call(v.childNodes), v.childNodes), E[v.childNodes.length].nodeType; } catch (fb) { H = { apply: E.length ? function (a, b) { G.apply(a, I.call(b)); } : function (a, b) { var c = a.length, d = 0; while (a[c++] = b[d++]); a.length = c - 1; } }; } function gb (a, b, d, e) { var f, h, j, k, l, o, r, s, w, x; if ((b ? b.ownerDocument || b : v) !== n && m(b), b = b || n, d = d || [], k = b.nodeType, "string" != typeof a || !a || 1 !== k && 9 !== k && 11 !== k) return d; if (!e && p) { if (11 !== k && (f = _.exec(a))) if (j = f[1]) { if (9 === k) { if (h = b.getElementById(j), !h || !h.parentNode) return d; if (h.id === j) return d.push(h), d; } else if (b.ownerDocument && (h = b.ownerDocument.getElementById(j)) && t(b, h) && h.id === j) return d.push(h), d; } else { if (f[2]) return H.apply(d, b.getElementsByTagName(a)), d; if ((j = f[3]) && c.getElementsByClassName) return H.apply(d, b.getElementsByClassName(j)), d; } if (c.qsa && (!q || !q.test(a))) { if (s = r = u, w = b, x = 1 !== k && a, 1 === k && "object" !== b.nodeName.toLowerCase()) { o = g(a), (r = b.getAttribute("id")) ? s = r.replace(bb, "\\$&") : b.setAttribute("id", s), s = "[id='" + s + "'] ", l = o.length; while (l--) o[l] = s + rb(o[l]); w = ab.test(a) && pb(b.parentNode) || b, x = o.join(","); } if (x) try { return H.apply(d, w.querySelectorAll(x)), d; } catch (y) { } finally { r || b.removeAttribute("id"); } } } return i(a.replace(R, "$1"), b, d, e); } function hb () { var a = []; function b (c, e) { return a.push(c + " ") > d.cacheLength && delete b[a.shift()], b[c + " "] = e; } return b; } function ib (a) { return a[u] = !0, a; } function jb (a) { var b = n.createElement("div"); try { return !!a(b); } catch (c) { return !1; } finally { b.parentNode && b.parentNode.removeChild(b), b = null; } } function kb (a, b) { var c = a.split("|"), e = a.length; while (e--) d.attrHandle[c[e]] = b; } function lb (a, b) { var c = b && a, d = c && 1 === a.nodeType && 1 === b.nodeType && (~b.sourceIndex || C) - (~a.sourceIndex || C); if (d) return d; if (c) while (c = c.nextSibling) if (c === b) return -1; return a ? 1 : -1; } function mb (a) { return function (b) { var c = b.nodeName.toLowerCase(); return "input" === c && b.type === a; }; } function nb (a) { return function (b) { var c = b.nodeName.toLowerCase(); return ("input" === c || "button" === c) && b.type === a; }; } function ob (a) { return ib(function (b) { return b = +b, ib(function (c, d) { var e, f = a([], c.length, b), g = f.length; while (g--) c[e = f[g]] && (c[e] = !(d[e] = c[e])); }); }); } function pb (a) { return a && "undefined" != typeof a.getElementsByTagName && a; } c = gb.support = {}, f = gb.isXML = function (a) { var b = a && (a.ownerDocument || a).documentElement; return b ? "HTML" !== b.nodeName : !1; }, m = gb.setDocument = function (a) { var b, e, g = a ? a.ownerDocument || a : v; return g !== n && 9 === g.nodeType && g.documentElement ? (n = g, o = g.documentElement, e = g.defaultView, e && e !== e.top && (e.addEventListener ? e.addEventListener("unload", eb, !1) : e.attachEvent && e.attachEvent("onunload", eb)), p = !f(g), c.attributes = jb(function (a) { return a.className = "i", !a.getAttribute("className"); }), c.getElementsByTagName = jb(function (a) { return a.appendChild(g.createComment("")), !a.getElementsByTagName("*").length; }), c.getElementsByClassName = $.test(g.getElementsByClassName), c.getById = jb(function (a) { return o.appendChild(a).id = u, !g.getElementsByName || !g.getElementsByName(u).length; }), c.getById ? (d.find.ID = function (a, b) { if ("undefined" != typeof b.getElementById && p) { var c = b.getElementById(a); return c && c.parentNode ? [c] : []; } }, d.filter.ID = function (a) { var b = a.replace(cb, db); return function (a) { return a.getAttribute("id") === b; }; }) : (delete d.find.ID, d.filter.ID = function (a) { var b = a.replace(cb, db); return function (a) { var c = "undefined" != typeof a.getAttributeNode && a.getAttributeNode("id"); return c && c.value === b; }; }), d.find.TAG = c.getElementsByTagName ? function (a, b) { return "undefined" != typeof b.getElementsByTagName ? b.getElementsByTagName(a) : c.qsa ? b.querySelectorAll(a) : void 0; } : function (a, b) { var c, d = [], e = 0, f = b.getElementsByTagName(a); if ("*" === a) { while (c = f[e++]) 1 === c.nodeType && d.push(c); return d; } return f; }, d.find.CLASS = c.getElementsByClassName && function (a, b) { return p ? b.getElementsByClassName(a) : void 0; }, r = [], q = [], (c.qsa = $.test(g.querySelectorAll)) && (jb(function (a) { o.appendChild(a).innerHTML = "<a id='" + u + "'></a><select id='" + u + "-\f]' msallowcapture=''><option selected=''></option></select>", a.querySelectorAll("[msallowcapture^='']").length && q.push("[*^$]=" + L + "*(?:''|\"\")"), a.querySelectorAll("[selected]").length || q.push("\\[" + L + "*(?:value|" + K + ")"), a.querySelectorAll("[id~=" + u + "-]").length || q.push("~="), a.querySelectorAll(":checked").length || q.push(":checked"), a.querySelectorAll("a#" + u + "+*").length || q.push(".#.+[+~]"); }), jb(function (a) { var b = g.createElement("input"); b.setAttribute("type", "hidden"), a.appendChild(b).setAttribute("name", "D"), a.querySelectorAll("[name=d]").length && q.push("name" + L + "*[*^$|!~]?="), a.querySelectorAll(":enabled").length || q.push(":enabled", ":disabled"), a.querySelectorAll("*,:x"), q.push(",.*:"); })), (c.matchesSelector = $.test(s = o.matches || o.webkitMatchesSelector || o.mozMatchesSelector || o.oMatchesSelector || o.msMatchesSelector)) && jb(function (a) { c.disconnectedMatch = s.call(a, "div"), s.call(a, "[s!='']:x"), r.push("!=", P); }), q = q.length && new RegExp(q.join("|")), r = r.length && new RegExp(r.join("|")), b = $.test(o.compareDocumentPosition), t = b || $.test(o.contains) ? function (a, b) { var c = 9 === a.nodeType ? a.documentElement : a, d = b && b.parentNode; return a === d || !(!d || 1 !== d.nodeType || !(c.contains ? c.contains(d) : a.compareDocumentPosition && 16 & a.compareDocumentPosition(d))); } : function (a, b) { if (b) while (b = b.parentNode) if (b === a) return !0; return !1; }, B = b ? function (a, b) { if (a === b) return l = !0, 0; var d = !a.compareDocumentPosition - !b.compareDocumentPosition; return d ? d : (d = (a.ownerDocument || a) === (b.ownerDocument || b) ? a.compareDocumentPosition(b) : 1, 1 & d || !c.sortDetached && b.compareDocumentPosition(a) === d ? a === g || a.ownerDocument === v && t(v, a) ? -1 : b === g || b.ownerDocument === v && t(v, b) ? 1 : k ? J(k, a) - J(k, b) : 0 : 4 & d ? -1 : 1); } : function (a, b) { if (a === b) return l = !0, 0; var c, d = 0, e = a.parentNode, f = b.parentNode, h = [a], i = [b]; if (!e || !f) return a === g ? -1 : b === g ? 1 : e ? -1 : f ? 1 : k ? J(k, a) - J(k, b) : 0; if (e === f) return lb(a, b); c = a; while (c = c.parentNode) h.unshift(c); c = b; while (c = c.parentNode) i.unshift(c); while (h[d] === i[d]) d++; return d ? lb(h[d], i[d]) : h[d] === v ? -1 : i[d] === v ? 1 : 0; }, g) : n; }, gb.matches = function (a, b) { return gb(a, null, null, b); }, gb.matchesSelector = function (a, b) { if ((a.ownerDocument || a) !== n && m(a), b = b.replace(U, "='$1']"), !(!c.matchesSelector || !p || r && r.test(b) || q && q.test(b))) try { var d = s.call(a, b); if (d || c.disconnectedMatch || a.document && 11 !== a.document.nodeType) return d; } catch (e) { } return gb(b, n, null, [a]).length > 0; }, gb.contains = function (a, b) { return (a.ownerDocument || a) !== n && m(a), t(a, b); }, gb.attr = function (a, b) { (a.ownerDocument || a) !== n && m(a); var e = d.attrHandle[b.toLowerCase()], f = e && D.call(d.attrHandle, b.toLowerCase()) ? e(a, b, !p) : void 0; return void 0 !== f ? f : c.attributes || !p ? a.getAttribute(b) : (f = a.getAttributeNode(b)) && f.specified ? f.value : null; }, gb.error = function (a) { throw new Error("Syntax error, unrecognized expression: " + a); }, gb.uniqueSort = function (a) { var b, d = [], e = 0, f = 0; if (l = !c.detectDuplicates, k = !c.sortStable && a.slice(0), a.sort(B), l) { while (b = a[f++]) b === a[f] && (e = d.push(f)); while (e--) a.splice(d[e], 1); } return k = null, a; }, e = gb.getText = function (a) { var b, c = "", d = 0, f = a.nodeType; if (f) { if (1 === f || 9 === f || 11 === f) { if ("string" == typeof a.textContent) return a.textContent; for (a = a.firstChild; a; a = a.nextSibling)c += e(a); } else if (3 === f || 4 === f) return a.nodeValue; } else while (b = a[d++]) c += e(b); return c; }, d = gb.selectors = { cacheLength: 50, createPseudo: ib, match: X, attrHandle: {}, find: {}, relative: { ">": { dir: "parentNode", first: !0 }, " ": { dir: "parentNode" }, "+": { dir: "previousSibling", first: !0 }, "~": { dir: "previousSibling" } }, preFilter: { ATTR: function (a) { return a[1] = a[1].replace(cb, db), a[3] = (a[3] || a[4] || a[5] || "").replace(cb, db), "~=" === a[2] && (a[3] = " " + a[3] + " "), a.slice(0, 4); }, CHILD: function (a) { return a[1] = a[1].toLowerCase(), "nth" === a[1].slice(0, 3) ? (a[3] || gb.error(a[0]), a[4] = +(a[4] ? a[5] + (a[6] || 1) : 2 * ("even" === a[3] || "odd" === a[3])), a[5] = +(a[7] + a[8] || "odd" === a[3])) : a[3] && gb.error(a[0]), a; }, PSEUDO: function (a) { var b, c = !a[6] && a[2]; return X.CHILD.test(a[0]) ? null : (a[3] ? a[2] = a[4] || a[5] || "" : c && V.test(c) && (b = g(c, !0)) && (b = c.indexOf(")", c.length - b) - c.length) && (a[0] = a[0].slice(0, b), a[2] = c.slice(0, b)), a.slice(0, 3)); } }, filter: { TAG: function (a) { var b = a.replace(cb, db).toLowerCase(); return "*" === a ? function () { return !0; } : function (a) { return a.nodeName && a.nodeName.toLowerCase() === b; }; }, CLASS: function (a) { var b = y[a + " "]; return b || (b = new RegExp("(^|" + L + ")" + a + "(" + L + "|$)")) && y(a, function (a) { return b.test("string" == typeof a.className && a.className || "undefined" != typeof a.getAttribute && a.getAttribute("class") || ""); }); }, ATTR: function (a, b, c) { return function (d) { var e = gb.attr(d, a); return null == e ? "!=" === b : b ? (e += "", "=" === b ? e === c : "!=" === b ? e !== c : "^=" === b ? c && 0 === e.indexOf(c) : "*=" === b ? c && e.indexOf(c) > -1 : "$=" === b ? c && e.slice(-c.length) === c : "~=" === b ? (" " + e.replace(Q, " ") + " ").indexOf(c) > -1 : "|=" === b ? e === c || e.slice(0, c.length + 1) === c + "-" : !1) : !0; }; }, CHILD: function (a, b, c, d, e) { var f = "nth" !== a.slice(0, 3), g = "last" !== a.slice(-4), h = "of-type" === b; return 1 === d && 0 === e ? function (a) { return !!a.parentNode; } : function (b, c, i) { var j, k, l, m, n, o, p = f !== g ? "nextSibling" : "previousSibling", q = b.parentNode, r = h && b.nodeName.toLowerCase(), s = !i && !h; if (q) { if (f) { while (p) { l = b; while (l = l[p]) if (h ? l.nodeName.toLowerCase() === r : 1 === l.nodeType) return !1; o = p = "only" === a && !o && "nextSibling"; } return !0; } if (o = [g ? q.firstChild : q.lastChild], g && s) { k = q[u] || (q[u] = {}), j = k[a] || [], n = j[0] === w && j[1], m = j[0] === w && j[2], l = n && q.childNodes[n]; while (l = ++n && l && l[p] || (m = n = 0) || o.pop()) if (1 === l.nodeType && ++m && l === b) { k[a] = [w, n, m]; break; } } else if (s && (j = (b[u] || (b[u] = {}))[a]) && j[0] === w) m = j[1]; else while (l = ++n && l && l[p] || (m = n = 0) || o.pop()) if ((h ? l.nodeName.toLowerCase() === r : 1 === l.nodeType) && ++m && (s && ((l[u] || (l[u] = {}))[a] = [w, m]), l === b)) break; return m -= e, m === d || m % d === 0 && m / d >= 0; } }; }, PSEUDO: function (a, b) { var c, e = d.pseudos[a] || d.setFilters[a.toLowerCase()] || gb.error("unsupported pseudo: " + a); return e[u] ? e(b) : e.length > 1 ? (c = [a, a, "", b], d.setFilters.hasOwnProperty(a.toLowerCase()) ? ib(function (a, c) { var d, f = e(a, b), g = f.length; while (g--) d = J(a, f[g]), a[d] = !(c[d] = f[g]); }) : function (a) { return e(a, 0, c); }) : e; } }, pseudos: { not: ib(function (a) { var b = [], c = [], d = h(a.replace(R, "$1")); return d[u] ? ib(function (a, b, c, e) { var f, g = d(a, null, e, []), h = a.length; while (h--) (f = g[h]) && (a[h] = !(b[h] = f)); }) : function (a, e, f) { return b[0] = a, d(b, null, f, c), b[0] = null, !c.pop(); }; }), has: ib(function (a) { return function (b) { return gb(a, b).length > 0; }; }), contains: ib(function (a) { return a = a.replace(cb, db), function (b) { return (b.textContent || b.innerText || e(b)).indexOf(a) > -1; }; }), lang: ib(function (a) { return W.test(a || "") || gb.error("unsupported lang: " + a), a = a.replace(cb, db).toLowerCase(), function (b) { var c; do if (c = p ? b.lang : b.getAttribute("xml:lang") || b.getAttribute("lang")) return c = c.toLowerCase(), c === a || 0 === c.indexOf(a + "-"); while ((b = b.parentNode) && 1 === b.nodeType); return !1; }; }), target: function (b) { var c = a.location && a.location.hash; return c && c.slice(1) === b.id; }, root: function (a) { return a === o; }, focus: function (a) { return a === n.activeElement && (!n.hasFocus || n.hasFocus()) && !!(a.type || a.href || ~a.tabIndex); }, enabled: function (a) { return a.disabled === !1; }, disabled: function (a) { return a.disabled === !0; }, checked: function (a) { var b = a.nodeName.toLowerCase(); return "input" === b && !!a.checked || "option" === b && !!a.selected; }, selected: function (a) { return a.parentNode && a.parentNode.selectedIndex, a.selected === !0; }, empty: function (a) { for (a = a.firstChild; a; a = a.nextSibling)if (a.nodeType < 6) return !1; return !0; }, parent: function (a) { return !d.pseudos.empty(a); }, header: function (a) { return Z.test(a.nodeName); }, input: function (a) { return Y.test(a.nodeName); }, button: function (a) { var b = a.nodeName.toLowerCase(); return "input" === b && "button" === a.type || "button" === b; }, text: function (a) { var b; return "input" === a.nodeName.toLowerCase() && "text" === a.type && (null == (b = a.getAttribute("type")) || "text" === b.toLowerCase()); }, first: ob(function () { return [0]; }), last: ob(function (a, b) { return [b - 1]; }), eq: ob(function (a, b, c) { return [0 > c ? c + b : c]; }), even: ob(function (a, b) { for (var c = 0; b > c; c += 2)a.push(c); return a; }), odd: ob(function (a, b) { for (var c = 1; b > c; c += 2)a.push(c); return a; }), lt: ob(function (a, b, c) { for (var d = 0 > c ? c + b : c; --d >= 0;)a.push(d); return a; }), gt: ob(function (a, b, c) { for (var d = 0 > c ? c + b : c; ++d < b;)a.push(d); return a; }) } }, d.pseudos.nth = d.pseudos.eq; for (b in { radio: !0, checkbox: !0, file: !0, password: !0, image: !0 }) d.pseudos[b] = mb(b); for (b in { submit: !0, reset: !0 }) d.pseudos[b] = nb(b); function qb () { } qb.prototype = d.filters = d.pseudos, d.setFilters = new qb, g = gb.tokenize = function (a, b) { var c, e, f, g, h, i, j, k = z[a + " "]; if (k) return b ? 0 : k.slice(0); h = a, i = [], j = d.preFilter; while (h) { (!c || (e = S.exec(h))) && (e && (h = h.slice(e[0].length) || h), i.push(f = [])), c = !1, (e = T.exec(h)) && (c = e.shift(), f.push({ value: c, type: e[0].replace(R, " ") }), h = h.slice(c.length)); for (g in d.filter) !(e = X[g].exec(h)) || j[g] && !(e = j[g](e)) || (c = e.shift(), f.push({ value: c, type: g, matches: e }), h = h.slice(c.length)); if (!c) break; } return b ? h.length : h ? gb.error(a) : z(a, i).slice(0); }; function rb (a) { for (var b = 0, c = a.length, d = ""; c > b; b++)d += a[b].value; return d; } function sb (a, b, c) { var d = b.dir, e = c && "parentNode" === d, f = x++; return b.first ? function (b, c, f) { while (b = b[d]) if (1 === b.nodeType || e) return a(b, c, f); } : function (b, c, g) { var h, i, j = [w, f]; if (g) { while (b = b[d]) if ((1 === b.nodeType || e) && a(b, c, g)) return !0; } else while (b = b[d]) if (1 === b.nodeType || e) { if (i = b[u] || (b[u] = {}), (h = i[d]) && h[0] === w && h[1] === f) return j[2] = h[2]; if (i[d] = j, j[2] = a(b, c, g)) return !0; } }; } function tb (a) { return a.length > 1 ? function (b, c, d) { var e = a.length; while (e--) if (!a[e](b, c, d)) return !1; return !0; } : a[0]; } function ub (a, b, c) { for (var d = 0, e = b.length; e > d; d++)gb(a, b[d], c); return c; } function vb (a, b, c, d, e) { for (var f, g = [], h = 0, i = a.length, j = null != b; i > h; h++)(f = a[h]) && (!c || c(f, d, e)) && (g.push(f), j && b.push(h)); return g; } function wb (a, b, c, d, e, f) { return d && !d[u] && (d = wb(d)), e && !e[u] && (e = wb(e, f)), ib(function (f, g, h, i) { var j, k, l, m = [], n = [], o = g.length, p = f || ub(b || "*", h.nodeType ? [h] : h, []), q = !a || !f && b ? p : vb(p, m, a, h, i), r = c ? e || (f ? a : o || d) ? [] : g : q; if (c && c(q, r, h, i), d) { j = vb(r, n), d(j, [], h, i), k = j.length; while (k--) (l = j[k]) && (r[n[k]] = !(q[n[k]] = l)); } if (f) { if (e || a) { if (e) { j = [], k = r.length; while (k--) (l = r[k]) && j.push(q[k] = l); e(null, r = [], j, i); } k = r.length; while (k--) (l = r[k]) && (j = e ? J(f, l) : m[k]) > -1 && (f[j] = !(g[j] = l)); } } else r = vb(r === g ? r.splice(o, r.length) : r), e ? e(null, g, r, i) : H.apply(g, r); }); } function xb (a) { for (var b, c, e, f = a.length, g = d.relative[a[0].type], h = g || d.relative[" "], i = g ? 1 : 0, k = sb(function (a) { return a === b; }, h, !0), l = sb(function (a) { return J(b, a) > -1; }, h, !0), m = [function (a, c, d) { var e = !g && (d || c !== j) || ((b = c).nodeType ? k(a, c, d) : l(a, c, d)); return b = null, e; }]; f > i; i++)if (c = d.relative[a[i].type]) m = [sb(tb(m), c)]; else { if (c = d.filter[a[i].type].apply(null, a[i].matches), c[u]) { for (e = ++i; f > e; e++)if (d.relative[a[e].type]) break; return wb(i > 1 && tb(m), i > 1 && rb(a.slice(0, i - 1).concat({ value: " " === a[i - 2].type ? "*" : "" })).replace(R, "$1"), c, e > i && xb(a.slice(i, e)), f > e && xb(a = a.slice(e)), f > e && rb(a)); } m.push(c); } return tb(m); } function yb (a, b) { var c = b.length > 0, e = a.length > 0, f = function (f, g, h, i, k) { var l, m, o, p = 0, q = "0", r = f && [], s = [], t = j, u = f || e && d.find.TAG("*", k), v = w += null == t ? 1 : Math.random() || .1, x = u.length; for (k && (j = g !== n && g); q !== x && null != (l = u[q]); q++) { if (e && l) { m = 0; while (o = a[m++]) if (o(l, g, h)) { i.push(l); break; } k && (w = v); } c && ((l = !o && l) && p--, f && r.push(l)); } if (p += q, c && q !== p) { m = 0; while (o = b[m++]) o(r, s, g, h); if (f) { if (p > 0) while (q--) r[q] || s[q] || (s[q] = F.call(i)); s = vb(s); } H.apply(i, s), k && !f && s.length > 0 && p + b.length > 1 && gb.uniqueSort(i); } return k && (w = v, j = t), r; }; return c ? ib(f) : f; } return h = gb.compile = function (a, b) { var c, d = [], e = [], f = A[a + " "]; if (!f) { b || (b = g(a)), c = b.length; while (c--) f = xb(b[c]), f[u] ? d.push(f) : e.push(f); f = A(a, yb(e, d)), f.selector = a; } return f; }, i = gb.select = function (a, b, e, f) { var i, j, k, l, m, n = "function" == typeof a && a, o = !f && g(a = n.selector || a); if (e = e || [], 1 === o.length) { if (j = o[0] = o[0].slice(0), j.length > 2 && "ID" === (k = j[0]).type && c.getById && 9 === b.nodeType && p && d.relative[j[1].type]) { if (b = (d.find.ID(k.matches[0].replace(cb, db), b) || [])[0], !b) return e; n && (b = b.parentNode), a = a.slice(j.shift().value.length); } i = X.needsContext.test(a) ? 0 : j.length; while (i--) { if (k = j[i], d.relative[l = k.type]) break; if ((m = d.find[l]) && (f = m(k.matches[0].replace(cb, db), ab.test(j[0].type) && pb(b.parentNode) || b))) { if (j.splice(i, 1), a = f.length && rb(j), !a) return H.apply(e, f), e; break; } } } return (n || h(a, o))(f, b, !p, e, ab.test(a) && pb(b.parentNode) || b), e; }, c.sortStable = u.split("").sort(B).join("") === u, c.detectDuplicates = !!l, m(), c.sortDetached = jb(function (a) { return 1 & a.compareDocumentPosition(n.createElement("div")); }), jb(function (a) { return a.innerHTML = "<a href='#'></a>", "#" === a.firstChild.getAttribute("href"); }) || kb("type|href|height|width", function (a, b, c) { return c ? void 0 : a.getAttribute(b, "type" === b.toLowerCase() ? 1 : 2); }), c.attributes && jb(function (a) { return a.innerHTML = "<input/>", a.firstChild.setAttribute("value", ""), "" === a.firstChild.getAttribute("value"); }) || kb("value", function (a, b, c) { return c || "input" !== a.nodeName.toLowerCase() ? void 0 : a.defaultValue; }), jb(function (a) { return null == a.getAttribute("disabled"); }) || kb(K, function (a, b, c) { var d; return c ? void 0 : a[b] === !0 ? b.toLowerCase() : (d = a.getAttributeNode(b)) && d.specified ? d.value : null; }), gb; }(a); n.find = t, n.expr = t.selectors, n.expr[":"] = n.expr.pseudos, n.unique = t.uniqueSort, n.text = t.getText, n.isXMLDoc = t.isXML, n.contains = t.contains; var u = n.expr.match.needsContext, v = /^<(\w+)\s*\/?>(?:<\/\1>|)$/, w = /^.[^:#\[\.,]*$/; function x (a, b, c) { if (n.isFunction(b)) return n.grep(a, function (a, d) { return !!b.call(a, d, a) !== c; }); if (b.nodeType) return n.grep(a, function (a) { return a === b !== c; }); if ("string" == typeof b) { if (w.test(b)) return n.filter(b, a, c); b = n.filter(b, a); } return n.grep(a, function (a) { return g.call(b, a) >= 0 !== c; }); } n.filter = function (a, b, c) { var d = b[0]; return c && (a = ":not(" + a + ")"), 1 === b.length && 1 === d.nodeType ? n.find.matchesSelector(d, a) ? [d] : [] : n.find.matches(a, n.grep(b, function (a) { return 1 === a.nodeType; })); }, n.fn.extend({ find: function (a) { var b, c = this.length, d = [], e = this; if ("string" != typeof a) return this.pushStack(n(a).filter(function () { for (b = 0; c > b; b++)if (n.contains(e[b], this)) return !0; })); for (b = 0; c > b; b++)n.find(a, e[b], d); return d = this.pushStack(c > 1 ? n.unique(d) : d), d.selector = this.selector ? this.selector + " " + a : a, d; }, filter: function (a) { return this.pushStack(x(this, a || [], !1)); }, not: function (a) { return this.pushStack(x(this, a || [], !0)); }, is: function (a) { return !!x(this, "string" == typeof a && u.test(a) ? n(a) : a || [], !1).length; } }); var y, z = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/, A = n.fn.init = function (a, b) { var c, d; if (!a) return this; if ("string" == typeof a) { if (c = "<" === a[0] && ">" === a[a.length - 1] && a.length >= 3 ? [null, a, null] : z.exec(a), !c || !c[1] && b) return !b || b.jquery ? (b || y).find(a) : this.constructor(b).find(a); if (c[1]) { if (b = b instanceof n ? b[0] : b, n.merge(this, n.parseHTML(c[1], b && b.nodeType ? b.ownerDocument || b : l, !0)), v.test(c[1]) && n.isPlainObject(b)) for (c in b) n.isFunction(this[c]) ? this[c](b[c]) : this.attr(c, b[c]); return this; } return d = l.getElementById(c[2]), d && d.parentNode && (this.length = 1, this[0] = d), this.context = l, this.selector = a, this; } return a.nodeType ? (this.context = this[0] = a, this.length = 1, this) : n.isFunction(a) ? "undefined" != typeof y.ready ? y.ready(a) : a(n) : (void 0 !== a.selector && (this.selector = a.selector, this.context = a.context), n.makeArray(a, this)); }; A.prototype = n.fn, y = n(l); var B = /^(?:parents|prev(?:Until|All))/, C = { children: !0, contents: !0, next: !0, prev: !0 }; n.extend({ dir: function (a, b, c) { var d = [], e = void 0 !== c; while ((a = a[b]) && 9 !== a.nodeType) if (1 === a.nodeType) { if (e && n(a).is(c)) break; d.push(a); } return d; }, sibling: function (a, b) { for (var c = []; a; a = a.nextSibling)1 === a.nodeType && a !== b && c.push(a); return c; } }), n.fn.extend({ has: function (a) { var b = n(a, this), c = b.length; return this.filter(function () { for (var a = 0; c > a; a++)if (n.contains(this, b[a])) return !0; }); }, closest: function (a, b) { for (var c, d = 0, e = this.length, f = [], g = u.test(a) || "string" != typeof a ? n(a, b || this.context) : 0; e > d; d++)for (c = this[d]; c && c !== b; c = c.parentNode)if (c.nodeType < 11 && (g ? g.index(c) > -1 : 1 === c.nodeType && n.find.matchesSelector(c, a))) { f.push(c); break; } return this.pushStack(f.length > 1 ? n.unique(f) : f); }, index: function (a) { return a ? "string" == typeof a ? g.call(n(a), this[0]) : g.call(this, a.jquery ? a[0] : a) : this[0] && this[0].parentNode ? this.first().prevAll().length : -1; }, add: function (a, b) { return this.pushStack(n.unique(n.merge(this.get(), n(a, b)))); }, addBack: function (a) { return this.add(null == a ? this.prevObject : this.prevObject.filter(a)); } }); function D (a, b) { while ((a = a[b]) && 1 !== a.nodeType); return a; } n.each({ parent: function (a) { var b = a.parentNode; return b && 11 !== b.nodeType ? b : null; }, parents: function (a) { return n.dir(a, "parentNode"); }, parentsUntil: function (a, b, c) { return n.dir(a, "parentNode", c); }, next: function (a) { return D(a, "nextSibling"); }, prev: function (a) { return D(a, "previousSibling"); }, nextAll: function (a) { return n.dir(a, "nextSibling"); }, prevAll: function (a) { return n.dir(a, "previousSibling"); }, nextUntil: function (a, b, c) { return n.dir(a, "nextSibling", c); }, prevUntil: function (a, b, c) { return n.dir(a, "previousSibling", c); }, siblings: function (a) { return n.sibling((a.parentNode || {}).firstChild, a); }, children: function (a) { return n.sibling(a.firstChild); }, contents: function (a) { return a.contentDocument || n.merge([], a.childNodes); } }, function (a, b) { n.fn[a] = function (c, d) { var e = n.map(this, b, c); return "Until" !== a.slice(-5) && (d = c), d && "string" == typeof d && (e = n.filter(d, e)), this.length > 1 && (C[a] || n.unique(e), B.test(a) && e.reverse()), this.pushStack(e); }; }); var E = /\S+/g, F = {}; function G (a) { var b = F[a] = {}; return n.each(a.match(E) || [], function (a, c) { b[c] = !0; }), b; } n.Callbacks = function (a) { a = "string" == typeof a ? F[a] || G(a) : n.extend({}, a); var b, c, d, e, f, g, h = [], i = !a.once && [], j = function (l) { for (b = a.memory && l, c = !0, g = e || 0, e = 0, f = h.length, d = !0; h && f > g; g++)if (h[g].apply(l[0], l[1]) === !1 && a.stopOnFalse) { b = !1; break; } d = !1, h && (i ? i.length && j(i.shift()) : b ? h = [] : k.disable()); }, k = { add: function () { if (h) { var c = h.length; !function g (b) { n.each(b, function (b, c) { var d = n.type(c); "function" === d ? a.unique && k.has(c) || h.push(c) : c && c.length && "string" !== d && g(c); }); }(arguments), d ? f = h.length : b && (e = c, j(b)); } return this; }, remove: function () { return h && n.each(arguments, function (a, b) { var c; while ((c = n.inArray(b, h, c)) > -1) h.splice(c, 1), d && (f >= c && f--, g >= c && g--); }), this; }, has: function (a) { return a ? n.inArray(a, h) > -1 : !(!h || !h.length); }, empty: function () { return h = [], f = 0, this; }, disable: function () { return h = i = b = void 0, this; }, disabled: function () { return !h; }, lock: function () { return i = void 0, b || k.disable(), this; }, locked: function () { return !i; }, fireWith: function (a, b) { return !h || c && !i || (b = b || [], b = [a, b.slice ? b.slice() : b], d ? i.push(b) : j(b)), this; }, fire: function () { return k.fireWith(this, arguments), this; }, fired: function () { return !!c; } }; return k; }, n.extend({ Deferred: function (a) { var b = [["resolve", "done", n.Callbacks("once memory"), "resolved"], ["reject", "fail", n.Callbacks("once memory"), "rejected"], ["notify", "progress", n.Callbacks("memory")]], c = "pending", d = { state: function () { return c; }, always: function () { return e.done(arguments).fail(arguments), this; }, then: function () { var a = arguments; return n.Deferred(function (c) { n.each(b, function (b, f) { var g = n.isFunction(a[b]) && a[b]; e[f[1]](function () { var a = g && g.apply(this, arguments); a && n.isFunction(a.promise) ? a.promise().done(c.resolve).fail(c.reject).progress(c.notify) : c[f[0] + "With"](this === d ? c.promise() : this, g ? [a] : arguments); }); }), a = null; }).promise(); }, promise: function (a) { return null != a ? n.extend(a, d) : d; } }, e = {}; return d.pipe = d.then, n.each(b, function (a, f) { var g = f[2], h = f[3]; d[f[1]] = g.add, h && g.add(function () { c = h; }, b[1 ^ a][2].disable, b[2][2].lock), e[f[0]] = function () { return e[f[0] + "With"](this === e ? d : this, arguments), this; }, e[f[0] + "With"] = g.fireWith; }), d.promise(e), a && a.call(e, e), e; }, when: function (a) { var b = 0, c = d.call(arguments), e = c.length, f = 1 !== e || a && n.isFunction(a.promise) ? e : 0, g = 1 === f ? a : n.Deferred(), h = function (a, b, c) { return function (e) { b[a] = this, c[a] = arguments.length > 1 ? d.call(arguments) : e, c === i ? g.notifyWith(b, c) : --f || g.resolveWith(b, c); }; }, i, j, k; if (e > 1) for (i = new Array(e), j = new Array(e), k = new Array(e); e > b; b++)c[b] && n.isFunction(c[b].promise) ? c[b].promise().done(h(b, k, c)).fail(g.reject).progress(h(b, j, i)) : --f; return f || g.resolveWith(k, c), g.promise(); } }); var H; n.fn.ready = function (a) { return n.ready.promise().done(a), this; }, n.extend({ isReady: !1, readyWait: 1, holdReady: function (a) { a ? n.readyWait++ : n.ready(!0); }, ready: function (a) { (a === !0 ? --n.readyWait : n.isReady) || (n.isReady = !0, a !== !0 && --n.readyWait > 0 || (H.resolveWith(l, [n]), n.fn.triggerHandler && (n(l).triggerHandler("ready"), n(l).off("ready")))); } }); function I () { l.removeEventListener("DOMContentLoaded", I, !1), a.removeEventListener("load", I, !1), n.ready(); } n.ready.promise = function (b) { return H || (H = n.Deferred(), "complete" === l.readyState ? setTimeout(n.ready) : (l.addEventListener("DOMContentLoaded", I, !1), a.addEventListener("load", I, !1))), H.promise(b); }, n.ready.promise(); var J = n.access = function (a, b, c, d, e, f, g) { var h = 0, i = a.length, j = null == c; if ("object" === n.type(c)) { e = !0; for (h in c) n.access(a, b, h, c[h], !0, f, g); } else if (void 0 !== d && (e = !0, n.isFunction(d) || (g = !0), j && (g ? (b.call(a, d), b = null) : (j = b, b = function (a, b, c) { return j.call(n(a), c); })), b)) for (; i > h; h++)b(a[h], c, g ? d : d.call(a[h], h, b(a[h], c))); return e ? a : j ? b.call(a) : i ? b(a[0], c) : f; }; n.acceptData = function (a) { return 1 === a.nodeType || 9 === a.nodeType || !+a.nodeType; }; function K () { Object.defineProperty(this.cache = {}, 0, { get: function () { return {}; } }), this.expando = n.expando + K.uid++; } K.uid = 1, K.accepts = n.acceptData, K.prototype = { key: function (a) { if (!K.accepts(a)) return 0; var b = {}, c = a[this.expando]; if (!c) { c = K.uid++; try { b[this.expando] = { value: c }, Object.defineProperties(a, b); } catch (d) { b[this.expando] = c, n.extend(a, b); } } return this.cache[c] || (this.cache[c] = {}), c; }, set: function (a, b, c) { var d, e = this.key(a), f = this.cache[e]; if ("string" == typeof b) f[b] = c; else if (n.isEmptyObject(f)) n.extend(this.cache[e], b); else for (d in b) f[d] = b[d]; return f; }, get: function (a, b) { var c = this.cache[this.key(a)]; return void 0 === b ? c : c[b]; }, access: function (a, b, c) { var d; return void 0 === b || b && "string" == typeof b && void 0 === c ? (d = this.get(a, b), void 0 !== d ? d : this.get(a, n.camelCase(b))) : (this.set(a, b, c), void 0 !== c ? c : b); }, remove: function (a, b) { var c, d, e, f = this.key(a), g = this.cache[f]; if (void 0 === b) this.cache[f] = {}; else { n.isArray(b) ? d = b.concat(b.map(n.camelCase)) : (e = n.camelCase(b), b in g ? d = [b, e] : (d = e, d = d in g ? [d] : d.match(E) || [])), c = d.length; while (c--) delete g[d[c]]; } }, hasData: function (a) { return !n.isEmptyObject(this.cache[a[this.expando]] || {}); }, discard: function (a) { a[this.expando] && delete this.cache[a[this.expando]]; } }; var L = new K, M = new K, N = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/, O = /([A-Z])/g; function P (a, b, c) { var d; if (void 0 === c && 1 === a.nodeType) if (d = "data-" + b.replace(O, "-$1").toLowerCase(), c = a.getAttribute(d), "string" == typeof c) { try { c = "true" === c ? !0 : "false" === c ? !1 : "null" === c ? null : +c + "" === c ? +c : N.test(c) ? n.parseJSON(c) : c; } catch (e) { } M.set(a, b, c); } else c = void 0; return c; } n.extend({
        hasData: function (a) { return M.hasData(a) || L.hasData(a); }, data: function (a, b, c)
        {
            return M.access(a, b, c);
        }, removeData: function (a, b) { M.remove(a, b); }, _data: function (a, b, c) { return L.access(a, b, c); }, _removeData: function (a, b) { L.remove(a, b); }
    }), n.fn.extend({ data: function (a, b) { var c, d, e, f = this[0], g = f && f.attributes; if (void 0 === a) { if (this.length && (e = M.get(f), 1 === f.nodeType && !L.get(f, "hasDataAttrs"))) { c = g.length; while (c--) g[c] && (d = g[c].name, 0 === d.indexOf("data-") && (d = n.camelCase(d.slice(5)), P(f, d, e[d]))); L.set(f, "hasDataAttrs", !0); } return e; } return "object" == typeof a ? this.each(function () { M.set(this, a); }) : J(this, function (b) { var c, d = n.camelCase(a); if (f && void 0 === b) { if (c = M.get(f, a), void 0 !== c) return c; if (c = M.get(f, d), void 0 !== c) return c; if (c = P(f, d, void 0), void 0 !== c) return c; } else this.each(function () { var c = M.get(this, d); M.set(this, d, b), -1 !== a.indexOf("-") && void 0 !== c && M.set(this, a, b); }); }, null, b, arguments.length > 1, null, !0); }, removeData: function (a) { return this.each(function () { M.remove(this, a); }); } }), n.extend({ queue: function (a, b, c) { var d; return a ? (b = (b || "fx") + "queue", d = L.get(a, b), c && (!d || n.isArray(c) ? d = L.access(a, b, n.makeArray(c)) : d.push(c)), d || []) : void 0; }, dequeue: function (a, b) { b = b || "fx"; var c = n.queue(a, b), d = c.length, e = c.shift(), f = n._queueHooks(a, b), g = function () { n.dequeue(a, b); }; "inprogress" === e && (e = c.shift(), d--), e && ("fx" === b && c.unshift("inprogress"), delete f.stop, e.call(a, g, f)), !d && f && f.empty.fire(); }, _queueHooks: function (a, b) { var c = b + "queueHooks"; return L.get(a, c) || L.access(a, c, { empty: n.Callbacks("once memory").add(function () { L.remove(a, [b + "queue", c]); }) }); } }), n.fn.extend({ queue: function (a, b) { var c = 2; return "string" != typeof a && (b = a, a = "fx", c--), arguments.length < c ? n.queue(this[0], a) : void 0 === b ? this : this.each(function () { var c = n.queue(this, a, b); n._queueHooks(this, a), "fx" === a && "inprogress" !== c[0] && n.dequeue(this, a); }); }, dequeue: function (a) { return this.each(function () { n.dequeue(this, a); }); }, clearQueue: function (a) { return this.queue(a || "fx", []); }, promise: function (a, b) { var c, d = 1, e = n.Deferred(), f = this, g = this.length, h = function () { --d || e.resolveWith(f, [f]); }; "string" != typeof a && (b = a, a = void 0), a = a || "fx"; while (g--) c = L.get(f[g], a + "queueHooks"), c && c.empty && (d++, c.empty.add(h)); return h(), e.promise(b); } }); var Q = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source, R = ["Top", "Right", "Bottom", "Left"], S = function (a, b) { return a = b || a, "none" === n.css(a, "display") || !n.contains(a.ownerDocument, a); }, T = /^(?:checkbox|radio)$/i; !function () { var a = l.createDocumentFragment(), b = a.appendChild(l.createElement("div")), c = l.createElement("input"); c.setAttribute("type", "radio"), c.setAttribute("checked", "checked"), c.setAttribute("name", "t"), b.appendChild(c), k.checkClone = b.cloneNode(!0).cloneNode(!0).lastChild.checked, b.innerHTML = "<textarea>x</textarea>", k.noCloneChecked = !!b.cloneNode(!0).lastChild.defaultValue; }(); var U = "undefined"; k.focusinBubbles = "onfocusin" in a; var V = /^key/, W = /^(?:mouse|pointer|contextmenu)|click/, X = /^(?:focusinfocus|focusoutblur)$/, Y = /^([^.]*)(?:\.(.+)|)$/; function Z () { return !0; } function $ () { return !1; } function _ () { try { return l.activeElement; } catch (a) { } } n.event = { global: {}, add: function (a, b, c, d, e) { var f, g, h, i, j, k, l, m, o, p, q, r = L.get(a); if (r) { c.handler && (f = c, c = f.handler, e = f.selector), c.guid || (c.guid = n.guid++), (i = r.events) || (i = r.events = {}), (g = r.handle) || (g = r.handle = function (b) { return typeof n !== U && n.event.triggered !== b.type ? n.event.dispatch.apply(a, arguments) : void 0; }), b = (b || "").match(E) || [""], j = b.length; while (j--) h = Y.exec(b[j]) || [], o = q = h[1], p = (h[2] || "").split(".").sort(), o && (l = n.event.special[o] || {}, o = (e ? l.delegateType : l.bindType) || o, l = n.event.special[o] || {}, k = n.extend({ type: o, origType: q, data: d, handler: c, guid: c.guid, selector: e, needsContext: e && n.expr.match.needsContext.test(e), namespace: p.join(".") }, f), (m = i[o]) || (m = i[o] = [], m.delegateCount = 0, l.setup && l.setup.call(a, d, p, g) !== !1 || a.addEventListener && a.addEventListener(o, g, !1)), l.add && (l.add.call(a, k), k.handler.guid || (k.handler.guid = c.guid)), e ? m.splice(m.delegateCount++, 0, k) : m.push(k), n.event.global[o] = !0); } }, remove: function (a, b, c, d, e) { var f, g, h, i, j, k, l, m, o, p, q, r = L.hasData(a) && L.get(a); if (r && (i = r.events)) { b = (b || "").match(E) || [""], j = b.length; while (j--) if (h = Y.exec(b[j]) || [], o = q = h[1], p = (h[2] || "").split(".").sort(), o) { l = n.event.special[o] || {}, o = (d ? l.delegateType : l.bindType) || o, m = i[o] || [], h = h[2] && new RegExp("(^|\\.)" + p.join("\\.(?:.*\\.|)") + "(\\.|$)"), g = f = m.length; while (f--) k = m[f], !e && q !== k.origType || c && c.guid !== k.guid || h && !h.test(k.namespace) || d && d !== k.selector && ("**" !== d || !k.selector) || (m.splice(f, 1), k.selector && m.delegateCount--, l.remove && l.remove.call(a, k)); g && !m.length && (l.teardown && l.teardown.call(a, p, r.handle) !== !1 || n.removeEvent(a, o, r.handle), delete i[o]); } else for (o in i) n.event.remove(a, o + b[j], c, d, !0); n.isEmptyObject(i) && (delete r.handle, L.remove(a, "events")); } }, trigger: function (b, c, d, e) { var f, g, h, i, k, m, o, p = [d || l], q = j.call(b, "type") ? b.type : b, r = j.call(b, "namespace") ? b.namespace.split(".") : []; if (g = h = d = d || l, 3 !== d.nodeType && 8 !== d.nodeType && !X.test(q + n.event.triggered) && (q.indexOf(".") >= 0 && (r = q.split("."), q = r.shift(), r.sort()), k = q.indexOf(":") < 0 && "on" + q, b = b[n.expando] ? b : new n.Event(q, "object" == typeof b && b), b.isTrigger = e ? 2 : 3, b.namespace = r.join("."), b.namespace_re = b.namespace ? new RegExp("(^|\\.)" + r.join("\\.(?:.*\\.|)") + "(\\.|$)") : null, b.result = void 0, b.target || (b.target = d), c = null == c ? [b] : n.makeArray(c, [b]), o = n.event.special[q] || {}, e || !o.trigger || o.trigger.apply(d, c) !== !1)) { if (!e && !o.noBubble && !n.isWindow(d)) { for (i = o.delegateType || q, X.test(i + q) || (g = g.parentNode); g; g = g.parentNode)p.push(g), h = g; h === (d.ownerDocument || l) && p.push(h.defaultView || h.parentWindow || a); } f = 0; while ((g = p[f++]) && !b.isPropagationStopped()) b.type = f > 1 ? i : o.bindType || q, m = (L.get(g, "events") || {})[b.type] && L.get(g, "handle"), m && m.apply(g, c), m = k && g[k], m && m.apply && n.acceptData(g) && (b.result = m.apply(g, c), b.result === !1 && b.preventDefault()); return b.type = q, e || b.isDefaultPrevented() || o._default && o._default.apply(p.pop(), c) !== !1 || !n.acceptData(d) || k && n.isFunction(d[q]) && !n.isWindow(d) && (h = d[k], h && (d[k] = null), n.event.triggered = q, d[q](), n.event.triggered = void 0, h && (d[k] = h)), b.result; } }, dispatch: function (a) { a = n.event.fix(a); var b, c, e, f, g, h = [], i = d.call(arguments), j = (L.get(this, "events") || {})[a.type] || [], k = n.event.special[a.type] || {}; if (i[0] = a, a.delegateTarget = this, !k.preDispatch || k.preDispatch.call(this, a) !== !1) { h = n.event.handlers.call(this, a, j), b = 0; while ((f = h[b++]) && !a.isPropagationStopped()) { a.currentTarget = f.elem, c = 0; while ((g = f.handlers[c++]) && !a.isImmediatePropagationStopped()) (!a.namespace_re || a.namespace_re.test(g.namespace)) && (a.handleObj = g, a.data = g.data, e = ((n.event.special[g.origType] || {}).handle || g.handler).apply(f.elem, i), void 0 !== e && (a.result = e) === !1 && (a.preventDefault(), a.stopPropagation())); } return k.postDispatch && k.postDispatch.call(this, a), a.result; } }, handlers: function (a, b) { var c, d, e, f, g = [], h = b.delegateCount, i = a.target; if (h && i.nodeType && (!a.button || "click" !== a.type)) for (; i !== this; i = i.parentNode || this)if (i.disabled !== !0 || "click" !== a.type) { for (d = [], c = 0; h > c; c++)f = b[c], e = f.selector + " ", void 0 === d[e] && (d[e] = f.needsContext ? n(e, this).index(i) >= 0 : n.find(e, this, null, [i]).length), d[e] && d.push(f); d.length && g.push({ elem: i, handlers: d }); } return h < b.length && g.push({ elem: this, handlers: b.slice(h) }), g; }, props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "), fixHooks: {}, keyHooks: { props: "char charCode key keyCode".split(" "), filter: function (a, b) { return null == a.which && (a.which = null != b.charCode ? b.charCode : b.keyCode), a; } }, mouseHooks: { props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "), filter: function (a, b) { var c, d, e, f = b.button; return null == a.pageX && null != b.clientX && (c = a.target.ownerDocument || l, d = c.documentElement, e = c.body, a.pageX = b.clientX + (d && d.scrollLeft || e && e.scrollLeft || 0) - (d && d.clientLeft || e && e.clientLeft || 0), a.pageY = b.clientY + (d && d.scrollTop || e && e.scrollTop || 0) - (d && d.clientTop || e && e.clientTop || 0)), a.which || void 0 === f || (a.which = 1 & f ? 1 : 2 & f ? 3 : 4 & f ? 2 : 0), a; } }, fix: function (a) { if (a[n.expando]) return a; var b, c, d, e = a.type, f = a, g = this.fixHooks[e]; g || (this.fixHooks[e] = g = W.test(e) ? this.mouseHooks : V.test(e) ? this.keyHooks : {}), d = g.props ? this.props.concat(g.props) : this.props, a = new n.Event(f), b = d.length; while (b--) c = d[b], a[c] = f[c]; return a.target || (a.target = l), 3 === a.target.nodeType && (a.target = a.target.parentNode), g.filter ? g.filter(a, f) : a; }, special: { load: { noBubble: !0 }, focus: { trigger: function () { return this !== _() && this.focus ? (this.focus(), !1) : void 0; }, delegateType: "focusin" }, blur: { trigger: function () { return this === _() && this.blur ? (this.blur(), !1) : void 0; }, delegateType: "focusout" }, click: { trigger: function () { return "checkbox" === this.type && this.click && n.nodeName(this, "input") ? (this.click(), !1) : void 0; }, _default: function (a) { return n.nodeName(a.target, "a"); } }, beforeunload: { postDispatch: function (a) { void 0 !== a.result && a.originalEvent && (a.originalEvent.returnValue = a.result); } } }, simulate: function (a, b, c, d) { var e = n.extend(new n.Event, c, { type: a, isSimulated: !0, originalEvent: {} }); d ? n.event.trigger(e, null, b) : n.event.dispatch.call(b, e), e.isDefaultPrevented() && c.preventDefault(); } }, n.removeEvent = function (a, b, c) { a.removeEventListener && a.removeEventListener(b, c, !1); }, n.Event = function (a, b) { return this instanceof n.Event ? (a && a.type ? (this.originalEvent = a, this.type = a.type, this.isDefaultPrevented = a.defaultPrevented || void 0 === a.defaultPrevented && a.returnValue === !1 ? Z : $) : this.type = a, b && n.extend(this, b), this.timeStamp = a && a.timeStamp || n.now(), void (this[n.expando] = !0)) : new n.Event(a, b); }, n.Event.prototype = { isDefaultPrevented: $, isPropagationStopped: $, isImmediatePropagationStopped: $, preventDefault: function () { var a = this.originalEvent; this.isDefaultPrevented = Z, a && a.preventDefault && a.preventDefault(); }, stopPropagation: function () { var a = this.originalEvent; this.isPropagationStopped = Z, a && a.stopPropagation && a.stopPropagation(); }, stopImmediatePropagation: function () { var a = this.originalEvent; this.isImmediatePropagationStopped = Z, a && a.stopImmediatePropagation && a.stopImmediatePropagation(), this.stopPropagation(); } }, n.each({ mouseenter: "mouseover", mouseleave: "mouseout", pointerenter: "pointerover", pointerleave: "pointerout" }, function (a, b) { n.event.special[a] = { delegateType: b, bindType: b, handle: function (a) { var c, d = this, e = a.relatedTarget, f = a.handleObj; return (!e || e !== d && !n.contains(d, e)) && (a.type = f.origType, c = f.handler.apply(this, arguments), a.type = b), c; } }; }), k.focusinBubbles || n.each({ focus: "focusin", blur: "focusout" }, function (a, b) { var c = function (a) { n.event.simulate(b, a.target, n.event.fix(a), !0); }; n.event.special[b] = { setup: function () { var d = this.ownerDocument || this, e = L.access(d, b); e || d.addEventListener(a, c, !0), L.access(d, b, (e || 0) + 1); }, teardown: function () { var d = this.ownerDocument || this, e = L.access(d, b) - 1; e ? L.access(d, b, e) : (d.removeEventListener(a, c, !0), L.remove(d, b)); } }; }), n.fn.extend({ on: function (a, b, c, d, e) { var f, g; if ("object" == typeof a) { "string" != typeof b && (c = c || b, b = void 0); for (g in a) this.on(g, b, c, a[g], e); return this; } if (null == c && null == d ? (d = b, c = b = void 0) : null == d && ("string" == typeof b ? (d = c, c = void 0) : (d = c, c = b, b = void 0)), d === !1) d = $; else if (!d) return this; return 1 === e && (f = d, d = function (a) { return n().off(a), f.apply(this, arguments); }, d.guid = f.guid || (f.guid = n.guid++)), this.each(function () { n.event.add(this, a, d, c, b); }); }, one: function (a, b, c, d) { return this.on(a, b, c, d, 1); }, off: function (a, b, c) { var d, e; if (a && a.preventDefault && a.handleObj) return d = a.handleObj, n(a.delegateTarget).off(d.namespace ? d.origType + "." + d.namespace : d.origType, d.selector, d.handler), this; if ("object" == typeof a) { for (e in a) this.off(e, b, a[e]); return this; } return (b === !1 || "function" == typeof b) && (c = b, b = void 0), c === !1 && (c = $), this.each(function () { n.event.remove(this, a, c, b); }); }, trigger: function (a, b) { return this.each(function () { n.event.trigger(a, b, this); }); }, triggerHandler: function (a, b) { var c = this[0]; return c ? n.event.trigger(a, b, c, !0) : void 0; } }); var ab = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi, bb = /<([\w:]+)/, cb = /<|&#?\w+;/, db = /<(?:script|style|link)/i, eb = /checked\s*(?:[^=]|=\s*.checked.)/i, fb = /^$|\/(?:java|ecma)script/i, gb = /^true\/(.*)/, hb = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g, ib = { option: [1, "<select multiple='multiple'>", "</select>"], thead: [1, "<table>", "</table>"], col: [2, "<table><colgroup>", "</colgroup></table>"], tr: [2, "<table><tbody>", "</tbody></table>"], td: [3, "<table><tbody><tr>", "</tr></tbody></table>"], _default: [0, "", ""] }; ib.optgroup = ib.option, ib.tbody = ib.tfoot = ib.colgroup = ib.caption = ib.thead, ib.th = ib.td; function jb (a, b) { return n.nodeName(a, "table") && n.nodeName(11 !== b.nodeType ? b : b.firstChild, "tr") ? a.getElementsByTagName("tbody")[0] || a.appendChild(a.ownerDocument.createElement("tbody")) : a; } function kb (a) { return a.type = (null !== a.getAttribute("type")) + "/" + a.type, a; } function lb (a) { var b = gb.exec(a.type); return b ? a.type = b[1] : a.removeAttribute("type"), a; } function mb (a, b) { for (var c = 0, d = a.length; d > c; c++)L.set(a[c], "globalEval", !b || L.get(b[c], "globalEval")); } function nb (a, b) { var c, d, e, f, g, h, i, j; if (1 === b.nodeType) { if (L.hasData(a) && (f = L.access(a), g = L.set(b, f), j = f.events)) { delete g.handle, g.events = {}; for (e in j) for (c = 0, d = j[e].length; d > c; c++)n.event.add(b, e, j[e][c]); } M.hasData(a) && (h = M.access(a), i = n.extend({}, h), M.set(b, i)); } } function ob (a, b) { var c = a.getElementsByTagName ? a.getElementsByTagName(b || "*") : a.querySelectorAll ? a.querySelectorAll(b || "*") : []; return void 0 === b || b && n.nodeName(a, b) ? n.merge([a], c) : c; } function pb (a, b) { var c = b.nodeName.toLowerCase(); "input" === c && T.test(a.type) ? b.checked = a.checked : ("input" === c || "textarea" === c) && (b.defaultValue = a.defaultValue); } n.extend({ clone: function (a, b, c) { var d, e, f, g, h = a.cloneNode(!0), i = n.contains(a.ownerDocument, a); if (!(k.noCloneChecked || 1 !== a.nodeType && 11 !== a.nodeType || n.isXMLDoc(a))) for (g = ob(h), f = ob(a), d = 0, e = f.length; e > d; d++)pb(f[d], g[d]); if (b) if (c) for (f = f || ob(a), g = g || ob(h), d = 0, e = f.length; e > d; d++)nb(f[d], g[d]); else nb(a, h); return g = ob(h, "script"), g.length > 0 && mb(g, !i && ob(a, "script")), h; }, buildFragment: function (a, b, c, d) { for (var e, f, g, h, i, j, k = b.createDocumentFragment(), l = [], m = 0, o = a.length; o > m; m++)if (e = a[m], e || 0 === e) if ("object" === n.type(e)) n.merge(l, e.nodeType ? [e] : e); else if (cb.test(e)) { f = f || k.appendChild(b.createElement("div")), g = (bb.exec(e) || ["", ""])[1].toLowerCase(), h = ib[g] || ib._default, f.innerHTML = h[1] + e.replace(ab, "<$1></$2>") + h[2], j = h[0]; while (j--) f = f.lastChild; n.merge(l, f.childNodes), f = k.firstChild, f.textContent = ""; } else l.push(b.createTextNode(e)); k.textContent = "", m = 0; while (e = l[m++]) if ((!d || -1 === n.inArray(e, d)) && (i = n.contains(e.ownerDocument, e), f = ob(k.appendChild(e), "script"), i && mb(f), c)) { j = 0; while (e = f[j++]) fb.test(e.type || "") && c.push(e); } return k; }, cleanData: function (a) { for (var b, c, d, e, f = n.event.special, g = 0; void 0 !== (c = a[g]); g++) { if (n.acceptData(c) && (e = c[L.expando], e && (b = L.cache[e]))) { if (b.events) for (d in b.events) f[d] ? n.event.remove(c, d) : n.removeEvent(c, d, b.handle); L.cache[e] && delete L.cache[e]; } delete M.cache[c[M.expando]]; } } }), n.fn.extend({ text: function (a) { return J(this, function (a) { return void 0 === a ? n.text(this) : this.empty().each(function () { (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) && (this.textContent = a); }); }, null, a, arguments.length); }, append: function () { return this.domManip(arguments, function (a) { if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) { var b = jb(this, a); b.appendChild(a); } }); }, prepend: function () { return this.domManip(arguments, function (a) { if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) { var b = jb(this, a); b.insertBefore(a, b.firstChild); } }); }, before: function () { return this.domManip(arguments, function (a) { this.parentNode && this.parentNode.insertBefore(a, this); }); }, after: function () { return this.domManip(arguments, function (a) { this.parentNode && this.parentNode.insertBefore(a, this.nextSibling); }); }, remove: function (a, b) { for (var c, d = a ? n.filter(a, this) : this, e = 0; null != (c = d[e]); e++)b || 1 !== c.nodeType || n.cleanData(ob(c)), c.parentNode && (b && n.contains(c.ownerDocument, c) && mb(ob(c, "script")), c.parentNode.removeChild(c)); return this; }, empty: function () { for (var a, b = 0; null != (a = this[b]); b++)1 === a.nodeType && (n.cleanData(ob(a, !1)), a.textContent = ""); return this; }, clone: function (a, b) { return a = null == a ? !1 : a, b = null == b ? a : b, this.map(function () { return n.clone(this, a, b); }); }, html: function (a) { return J(this, function (a) { var b = this[0] || {}, c = 0, d = this.length; if (void 0 === a && 1 === b.nodeType) return b.innerHTML; if ("string" == typeof a && !db.test(a) && !ib[(bb.exec(a) || ["", ""])[1].toLowerCase()]) { a = a.replace(ab, "<$1></$2>"); try { for (; d > c; c++)b = this[c] || {}, 1 === b.nodeType && (n.cleanData(ob(b, !1)), b.innerHTML = a); b = 0; } catch (e) { } } b && this.empty().append(a); }, null, a, arguments.length); }, replaceWith: function () { var a = arguments[0]; return this.domManip(arguments, function (b) { a = this.parentNode, n.cleanData(ob(this)), a && a.replaceChild(b, this); }), a && (a.length || a.nodeType) ? this : this.remove(); }, detach: function (a) { return this.remove(a, !0); }, domManip: function (a, b) { a = e.apply([], a); var c, d, f, g, h, i, j = 0, l = this.length, m = this, o = l - 1, p = a[0], q = n.isFunction(p); if (q || l > 1 && "string" == typeof p && !k.checkClone && eb.test(p)) return this.each(function (c) { var d = m.eq(c); q && (a[0] = p.call(this, c, d.html())), d.domManip(a, b); }); if (l && (c = n.buildFragment(a, this[0].ownerDocument, !1, this), d = c.firstChild, 1 === c.childNodes.length && (c = d), d)) { for (f = n.map(ob(c, "script"), kb), g = f.length; l > j; j++)h = c, j !== o && (h = n.clone(h, !0, !0), g && n.merge(f, ob(h, "script"))), b.call(this[j], h, j); if (g) for (i = f[f.length - 1].ownerDocument, n.map(f, lb), j = 0; g > j; j++)h = f[j], fb.test(h.type || "") && !L.access(h, "globalEval") && n.contains(i, h) && (h.src ? n._evalUrl && n._evalUrl(h.src) : n.globalEval(h.textContent.replace(hb, ""))); } return this; } }), n.each({ appendTo: "append", prependTo: "prepend", insertBefore: "before", insertAfter: "after", replaceAll: "replaceWith" }, function (a, b) { n.fn[a] = function (a) { for (var c, d = [], e = n(a), g = e.length - 1, h = 0; g >= h; h++)c = h === g ? this : this.clone(!0), n(e[h])[b](c), f.apply(d, c.get()); return this.pushStack(d); }; }); var qb, rb = {}; function sb (b, c) { var d, e = n(c.createElement(b)).appendTo(c.body), f = a.getDefaultComputedStyle && (d = a.getDefaultComputedStyle(e[0])) ? d.display : n.css(e[0], "display"); return e.detach(), f; } function tb (a) { var b = l, c = rb[a]; return c || (c = sb(a, b), "none" !== c && c || (qb = (qb || n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement), b = qb[0].contentDocument, b.write(), b.close(), c = sb(a, b), qb.detach()), rb[a] = c), c; } var ub = /^margin/, vb = new RegExp("^(" + Q + ")(?!px)[a-z%]+$", "i"), wb = function (b) { return b.ownerDocument.defaultView.opener ? b.ownerDocument.defaultView.getComputedStyle(b, null) : a.getComputedStyle(b, null); }; function xb (a, b, c) { var d, e, f, g, h = a.style; return c = c || wb(a), c && (g = c.getPropertyValue(b) || c[b]), c && ("" !== g || n.contains(a.ownerDocument, a) || (g = n.style(a, b)), vb.test(g) && ub.test(b) && (d = h.width, e = h.minWidth, f = h.maxWidth, h.minWidth = h.maxWidth = h.width = g, g = c.width, h.width = d, h.minWidth = e, h.maxWidth = f)), void 0 !== g ? g + "" : g; } function yb (a, b) { return { get: function () { return a() ? void delete this.get : (this.get = b).apply(this, arguments); } }; } !function () { var b, c, d = l.documentElement, e = l.createElement("div"), f = l.createElement("div"); if (f.style) { f.style.backgroundClip = "content-box", f.cloneNode(!0).style.backgroundClip = "", k.clearCloneStyle = "content-box" === f.style.backgroundClip, e.style.cssText = "border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;position:absolute", e.appendChild(f); function g () { f.style.cssText = "-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute", f.innerHTML = "", d.appendChild(e); var g = a.getComputedStyle(f, null); b = "1%" !== g.top, c = "4px" === g.width, d.removeChild(e); } a.getComputedStyle && n.extend(k, { pixelPosition: function () { return g(), b; }, boxSizingReliable: function () { return null == c && g(), c; }, reliableMarginRight: function () { var b, c = f.appendChild(l.createElement("div")); return c.style.cssText = f.style.cssText = "-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0", c.style.marginRight = c.style.width = "0", f.style.width = "1px", d.appendChild(e), b = !parseFloat(a.getComputedStyle(c, null).marginRight), d.removeChild(e), f.removeChild(c), b; } }); } }(), n.swap = function (a, b, c, d) { var e, f, g = {}; for (f in b) g[f] = a.style[f], a.style[f] = b[f]; e = c.apply(a, d || []); for (f in b) a.style[f] = g[f]; return e; }; var zb = /^(none|table(?!-c[ea]).+)/, Ab = new RegExp("^(" + Q + ")(.*)$", "i"), Bb = new RegExp("^([+-])=(" + Q + ")", "i"), Cb = { position: "absolute", visibility: "hidden", display: "block" }, Db = { letterSpacing: "0", fontWeight: "400" }, Eb = ["Webkit", "O", "Moz", "ms"]; function Fb (a, b) { if (b in a) return b; var c = b[0].toUpperCase() + b.slice(1), d = b, e = Eb.length; while (e--) if (b = Eb[e] + c, b in a) return b; return d; } function Gb (a, b, c) { var d = Ab.exec(b); return d ? Math.max(0, d[1] - (c || 0)) + (d[2] || "px") : b; } function Hb (a, b, c, d, e) { for (var f = c === (d ? "border" : "content") ? 4 : "width" === b ? 1 : 0, g = 0; 4 > f; f += 2)"margin" === c && (g += n.css(a, c + R[f], !0, e)), d ? ("content" === c && (g -= n.css(a, "padding" + R[f], !0, e)), "margin" !== c && (g -= n.css(a, "border" + R[f] + "Width", !0, e))) : (g += n.css(a, "padding" + R[f], !0, e), "padding" !== c && (g += n.css(a, "border" + R[f] + "Width", !0, e))); return g; } function Ib (a, b, c) { var d = !0, e = "width" === b ? a.offsetWidth : a.offsetHeight, f = wb(a), g = "border-box" === n.css(a, "boxSizing", !1, f); if (0 >= e || null == e) { if (e = xb(a, b, f), (0 > e || null == e) && (e = a.style[b]), vb.test(e)) return e; d = g && (k.boxSizingReliable() || e === a.style[b]), e = parseFloat(e) || 0; } return e + Hb(a, b, c || (g ? "border" : "content"), d, f) + "px"; } function Jb (a, b) { for (var c, d, e, f = [], g = 0, h = a.length; h > g; g++)d = a[g], d.style && (f[g] = L.get(d, "olddisplay"), c = d.style.display, b ? (f[g] || "none" !== c || (d.style.display = ""), "" === d.style.display && S(d) && (f[g] = L.access(d, "olddisplay", tb(d.nodeName)))) : (e = S(d), "none" === c && e || L.set(d, "olddisplay", e ? c : n.css(d, "display")))); for (g = 0; h > g; g++)d = a[g], d.style && (b && "none" !== d.style.display && "" !== d.style.display || (d.style.display = b ? f[g] || "" : "none")); return a; } n.extend({ cssHooks: { opacity: { get: function (a, b) { if (b) { var c = xb(a, "opacity"); return "" === c ? "1" : c; } } } }, cssNumber: { columnCount: !0, fillOpacity: !0, flexGrow: !0, flexShrink: !0, fontWeight: !0, lineHeight: !0, opacity: !0, order: !0, orphans: !0, widows: !0, zIndex: !0, zoom: !0 }, cssProps: { "float": "cssFloat" }, style: function (a, b, c, d) { if (a && 3 !== a.nodeType && 8 !== a.nodeType && a.style) { var e, f, g, h = n.camelCase(b), i = a.style; return b = n.cssProps[h] || (n.cssProps[h] = Fb(i, h)), g = n.cssHooks[b] || n.cssHooks[h], void 0 === c ? g && "get" in g && void 0 !== (e = g.get(a, !1, d)) ? e : i[b] : (f = typeof c, "string" === f && (e = Bb.exec(c)) && (c = (e[1] + 1) * e[2] + parseFloat(n.css(a, b)), f = "number"), null != c && c === c && ("number" !== f || n.cssNumber[h] || (c += "px"), k.clearCloneStyle || "" !== c || 0 !== b.indexOf("background") || (i[b] = "inherit"), g && "set" in g && void 0 === (c = g.set(a, c, d)) || (i[b] = c)), void 0); } }, css: function (a, b, c, d) { var e, f, g, h = n.camelCase(b); return b = n.cssProps[h] || (n.cssProps[h] = Fb(a.style, h)), g = n.cssHooks[b] || n.cssHooks[h], g && "get" in g && (e = g.get(a, !0, c)), void 0 === e && (e = xb(a, b, d)), "normal" === e && b in Db && (e = Db[b]), "" === c || c ? (f = parseFloat(e), c === !0 || n.isNumeric(f) ? f || 0 : e) : e; } }), n.each(["height", "width"], function (a, b) { n.cssHooks[b] = { get: function (a, c, d) { return c ? zb.test(n.css(a, "display")) && 0 === a.offsetWidth ? n.swap(a, Cb, function () { return Ib(a, b, d); }) : Ib(a, b, d) : void 0; }, set: function (a, c, d) { var e = d && wb(a); return Gb(a, c, d ? Hb(a, b, d, "border-box" === n.css(a, "boxSizing", !1, e), e) : 0); } }; }), n.cssHooks.marginRight = yb(k.reliableMarginRight, function (a, b) { return b ? n.swap(a, { display: "inline-block" }, xb, [a, "marginRight"]) : void 0; }), n.each({ margin: "", padding: "", border: "Width" }, function (a, b) { n.cssHooks[a + b] = { expand: function (c) { for (var d = 0, e = {}, f = "string" == typeof c ? c.split(" ") : [c]; 4 > d; d++)e[a + R[d] + b] = f[d] || f[d - 2] || f[0]; return e; } }, ub.test(a) || (n.cssHooks[a + b].set = Gb); }), n.fn.extend({ css: function (a, b) { return J(this, function (a, b, c) { var d, e, f = {}, g = 0; if (n.isArray(b)) { for (d = wb(a), e = b.length; e > g; g++)f[b[g]] = n.css(a, b[g], !1, d); return f; } return void 0 !== c ? n.style(a, b, c) : n.css(a, b); }, a, b, arguments.length > 1); }, show: function () { return Jb(this, !0); }, hide: function () { return Jb(this); }, toggle: function (a) { return "boolean" == typeof a ? a ? this.show() : this.hide() : this.each(function () { S(this) ? n(this).show() : n(this).hide(); }); } }); function Kb (a, b, c, d, e) { return new Kb.prototype.init(a, b, c, d, e); } n.Tween = Kb, Kb.prototype = { constructor: Kb, init: function (a, b, c, d, e, f) { this.elem = a, this.prop = c, this.easing = e || "swing", this.options = b, this.start = this.now = this.cur(), this.end = d, this.unit = f || (n.cssNumber[c] ? "" : "px"); }, cur: function () { var a = Kb.propHooks[this.prop]; return a && a.get ? a.get(this) : Kb.propHooks._default.get(this); }, run: function (a) { var b, c = Kb.propHooks[this.prop]; return this.pos = b = this.options.duration ? n.easing[this.easing](a, this.options.duration * a, 0, 1, this.options.duration) : a, this.now = (this.end - this.start) * b + this.start, this.options.step && this.options.step.call(this.elem, this.now, this), c && c.set ? c.set(this) : Kb.propHooks._default.set(this), this; } }, Kb.prototype.init.prototype = Kb.prototype, Kb.propHooks = { _default: { get: function (a) { var b; return null == a.elem[a.prop] || a.elem.style && null != a.elem.style[a.prop] ? (b = n.css(a.elem, a.prop, ""), b && "auto" !== b ? b : 0) : a.elem[a.prop]; }, set: function (a) { n.fx.step[a.prop] ? n.fx.step[a.prop](a) : a.elem.style && (null != a.elem.style[n.cssProps[a.prop]] || n.cssHooks[a.prop]) ? n.style(a.elem, a.prop, a.now + a.unit) : a.elem[a.prop] = a.now; } } }, Kb.propHooks.scrollTop = Kb.propHooks.scrollLeft = { set: function (a) { a.elem.nodeType && a.elem.parentNode && (a.elem[a.prop] = a.now); } }, n.easing = { linear: function (a) { return a; }, swing: function (a) { return .5 - Math.cos(a * Math.PI) / 2; } }, n.fx = Kb.prototype.init, n.fx.step = {}; var Lb, Mb, Nb = /^(?:toggle|show|hide)$/, Ob = new RegExp("^(?:([+-])=|)(" + Q + ")([a-z%]*)$", "i"), Pb = /queueHooks$/, Qb = [Vb], Rb = { "*": [function (a, b) { var c = this.createTween(a, b), d = c.cur(), e = Ob.exec(b), f = e && e[3] || (n.cssNumber[a] ? "" : "px"), g = (n.cssNumber[a] || "px" !== f && +d) && Ob.exec(n.css(c.elem, a)), h = 1, i = 20; if (g && g[3] !== f) { f = f || g[3], e = e || [], g = +d || 1; do h = h || ".5", g /= h, n.style(c.elem, a, g + f); while (h !== (h = c.cur() / d) && 1 !== h && --i); } return e && (g = c.start = +g || +d || 0, c.unit = f, c.end = e[1] ? g + (e[1] + 1) * e[2] : +e[2]), c; }] }; function Sb () { return setTimeout(function () { Lb = void 0; }), Lb = n.now(); } function Tb (a, b) { var c, d = 0, e = { height: a }; for (b = b ? 1 : 0; 4 > d; d += 2 - b)c = R[d], e["margin" + c] = e["padding" + c] = a; return b && (e.opacity = e.width = a), e; } function Ub (a, b, c) { for (var d, e = (Rb[b] || []).concat(Rb["*"]), f = 0, g = e.length; g > f; f++)if (d = e[f].call(c, b, a)) return d; } function Vb (a, b, c) { var d, e, f, g, h, i, j, k, l = this, m = {}, o = a.style, p = a.nodeType && S(a), q = L.get(a, "fxshow"); c.queue || (h = n._queueHooks(a, "fx"), null == h.unqueued && (h.unqueued = 0, i = h.empty.fire, h.empty.fire = function () { h.unqueued || i(); }), h.unqueued++, l.always(function () { l.always(function () { h.unqueued--, n.queue(a, "fx").length || h.empty.fire(); }); })), 1 === a.nodeType && ("height" in b || "width" in b) && (c.overflow = [o.overflow, o.overflowX, o.overflowY], j = n.css(a, "display"), k = "none" === j ? L.get(a, "olddisplay") || tb(a.nodeName) : j, "inline" === k && "none" === n.css(a, "float") && (o.display = "inline-block")), c.overflow && (o.overflow = "hidden", l.always(function () { o.overflow = c.overflow[0], o.overflowX = c.overflow[1], o.overflowY = c.overflow[2]; })); for (d in b) if (e = b[d], Nb.exec(e)) { if (delete b[d], f = f || "toggle" === e, e === (p ? "hide" : "show")) { if ("show" !== e || !q || void 0 === q[d]) continue; p = !0; } m[d] = q && q[d] || n.style(a, d); } else j = void 0; if (n.isEmptyObject(m)) "inline" === ("none" === j ? tb(a.nodeName) : j) && (o.display = j); else { q ? "hidden" in q && (p = q.hidden) : q = L.access(a, "fxshow", {}), f && (q.hidden = !p), p ? n(a).show() : l.done(function () { n(a).hide(); }), l.done(function () { var b; L.remove(a, "fxshow"); for (b in m) n.style(a, b, m[b]); }); for (d in m) g = Ub(p ? q[d] : 0, d, l), d in q || (q[d] = g.start, p && (g.end = g.start, g.start = "width" === d || "height" === d ? 1 : 0)); } } function Wb (a, b) { var c, d, e, f, g; for (c in a) if (d = n.camelCase(c), e = b[d], f = a[c], n.isArray(f) && (e = f[1], f = a[c] = f[0]), c !== d && (a[d] = f, delete a[c]), g = n.cssHooks[d], g && "expand" in g) { f = g.expand(f), delete a[d]; for (c in f) c in a || (a[c] = f[c], b[c] = e); } else b[d] = e; } function Xb (a, b, c) { var d, e, f = 0, g = Qb.length, h = n.Deferred().always(function () { delete i.elem; }), i = function () { if (e) return !1; for (var b = Lb || Sb(), c = Math.max(0, j.startTime + j.duration - b), d = c / j.duration || 0, f = 1 - d, g = 0, i = j.tweens.length; i > g; g++)j.tweens[g].run(f); return h.notifyWith(a, [j, f, c]), 1 > f && i ? c : (h.resolveWith(a, [j]), !1); }, j = h.promise({ elem: a, props: n.extend({}, b), opts: n.extend(!0, { specialEasing: {} }, c), originalProperties: b, originalOptions: c, startTime: Lb || Sb(), duration: c.duration, tweens: [], createTween: function (b, c) { var d = n.Tween(a, j.opts, b, c, j.opts.specialEasing[b] || j.opts.easing); return j.tweens.push(d), d; }, stop: function (b) { var c = 0, d = b ? j.tweens.length : 0; if (e) return this; for (e = !0; d > c; c++)j.tweens[c].run(1); return b ? h.resolveWith(a, [j, b]) : h.rejectWith(a, [j, b]), this; } }), k = j.props; for (Wb(k, j.opts.specialEasing); g > f; f++)if (d = Qb[f].call(j, a, k, j.opts)) return d; return n.map(k, Ub, j), n.isFunction(j.opts.start) && j.opts.start.call(a, j), n.fx.timer(n.extend(i, { elem: a, anim: j, queue: j.opts.queue })), j.progress(j.opts.progress).done(j.opts.done, j.opts.complete).fail(j.opts.fail).always(j.opts.always); } n.Animation = n.extend(Xb, { tweener: function (a, b) { n.isFunction(a) ? (b = a, a = ["*"]) : a = a.split(" "); for (var c, d = 0, e = a.length; e > d; d++)c = a[d], Rb[c] = Rb[c] || [], Rb[c].unshift(b); }, prefilter: function (a, b) { b ? Qb.unshift(a) : Qb.push(a); } }), n.speed = function (a, b, c) { var d = a && "object" == typeof a ? n.extend({}, a) : { complete: c || !c && b || n.isFunction(a) && a, duration: a, easing: c && b || b && !n.isFunction(b) && b }; return d.duration = n.fx.off ? 0 : "number" == typeof d.duration ? d.duration : d.duration in n.fx.speeds ? n.fx.speeds[d.duration] : n.fx.speeds._default, (null == d.queue || d.queue === !0) && (d.queue = "fx"), d.old = d.complete, d.complete = function () { n.isFunction(d.old) && d.old.call(this), d.queue && n.dequeue(this, d.queue); }, d; }, n.fn.extend({ fadeTo: function (a, b, c, d) { return this.filter(S).css("opacity", 0).show().end().animate({ opacity: b }, a, c, d); }, animate: function (a, b, c, d) { var e = n.isEmptyObject(a), f = n.speed(b, c, d), g = function () { var b = Xb(this, n.extend({}, a), f); (e || L.get(this, "finish")) && b.stop(!0); }; return g.finish = g, e || f.queue === !1 ? this.each(g) : this.queue(f.queue, g); }, stop: function (a, b, c) { var d = function (a) { var b = a.stop; delete a.stop, b(c); }; return "string" != typeof a && (c = b, b = a, a = void 0), b && a !== !1 && this.queue(a || "fx", []), this.each(function () { var b = !0, e = null != a && a + "queueHooks", f = n.timers, g = L.get(this); if (e) g[e] && g[e].stop && d(g[e]); else for (e in g) g[e] && g[e].stop && Pb.test(e) && d(g[e]); for (e = f.length; e--;)f[e].elem !== this || null != a && f[e].queue !== a || (f[e].anim.stop(c), b = !1, f.splice(e, 1)); (b || !c) && n.dequeue(this, a); }); }, finish: function (a) { return a !== !1 && (a = a || "fx"), this.each(function () { var b, c = L.get(this), d = c[a + "queue"], e = c[a + "queueHooks"], f = n.timers, g = d ? d.length : 0; for (c.finish = !0, n.queue(this, a, []), e && e.stop && e.stop.call(this, !0), b = f.length; b--;)f[b].elem === this && f[b].queue === a && (f[b].anim.stop(!0), f.splice(b, 1)); for (b = 0; g > b; b++)d[b] && d[b].finish && d[b].finish.call(this); delete c.finish; }); } }), n.each(["toggle", "show", "hide"], function (a, b) { var c = n.fn[b]; n.fn[b] = function (a, d, e) { return null == a || "boolean" == typeof a ? c.apply(this, arguments) : this.animate(Tb(b, !0), a, d, e); }; }), n.each({ slideDown: Tb("show"), slideUp: Tb("hide"), slideToggle: Tb("toggle"), fadeIn: { opacity: "show" }, fadeOut: { opacity: "hide" }, fadeToggle: { opacity: "toggle" } }, function (a, b) { n.fn[a] = function (a, c, d) { return this.animate(b, a, c, d); }; }), n.timers = [], n.fx.tick = function () { var a, b = 0, c = n.timers; for (Lb = n.now(); b < c.length; b++)a = c[b], a() || c[b] !== a || c.splice(b--, 1); c.length || n.fx.stop(), Lb = void 0; }, n.fx.timer = function (a) { n.timers.push(a), a() ? n.fx.start() : n.timers.pop(); }, n.fx.interval = 13, n.fx.start = function () { Mb || (Mb = setInterval(n.fx.tick, n.fx.interval)); }, n.fx.stop = function () { clearInterval(Mb), Mb = null; }, n.fx.speeds = { slow: 600, fast: 200, _default: 400 }, n.fn.delay = function (a, b) { return a = n.fx ? n.fx.speeds[a] || a : a, b = b || "fx", this.queue(b, function (b, c) { var d = setTimeout(b, a); c.stop = function () { clearTimeout(d); }; }); }, function () { var a = l.createElement("input"), b = l.createElement("select"), c = b.appendChild(l.createElement("option")); a.type = "checkbox", k.checkOn = "" !== a.value, k.optSelected = c.selected, b.disabled = !0, k.optDisabled = !c.disabled, a = l.createElement("input"), a.value = "t", a.type = "radio", k.radioValue = "t" === a.value; }(); var Yb, Zb, $b = n.expr.attrHandle; n.fn.extend({ attr: function (a, b) { return J(this, n.attr, a, b, arguments.length > 1); }, removeAttr: function (a) { return this.each(function () { n.removeAttr(this, a); }); } }), n.extend({
        attr: function (a, b, c)
        {
            var d, e, f = a.nodeType; if (a && 3 !== f && 8 !== f && 2 !== f) return typeof a.getAttribute === U ? n.prop(a, b, c) : (1 === f && n.isXMLDoc(a) || (b = b.toLowerCase(), d = n.attrHooks[b] || (n.expr.match.bool.test(b) ? Zb : Yb)), void 0 === c ? d && "get" in d && null !== (e = d.get(a, b)) ? e : (e = n.find.attr(a, b), null == e ? void 0 : e) : null !== c ? d && "set" in d && void 0 !== (e = d.set(a, c, b)) ? e : (a.setAttribute(b, c + ""), c) : void n.removeAttr(a, b));
        }, removeAttr: function (a, b) { var c, d, e = 0, f = b && b.match(E); if (f && 1 === a.nodeType) while (c = f[e++]) d = n.propFix[c] || c, n.expr.match.bool.test(c) && (a[d] = !1), a.removeAttribute(c); }, attrHooks: { type: { set: function (a, b) { if (!k.radioValue && "radio" === b && n.nodeName(a, "input")) { var c = a.value; return a.setAttribute("type", b), c && (a.value = c), b; } } } }
    }), Zb = { set: function (a, b, c) { return b === !1 ? n.removeAttr(a, c) : a.setAttribute(c, c), c; } }, n.each(n.expr.match.bool.source.match(/\w+/g), function (a, b) { var c = $b[b] || n.find.attr; $b[b] = function (a, b, d) { var e, f; return d || (f = $b[b], $b[b] = e, e = null != c(a, b, d) ? b.toLowerCase() : null, $b[b] = f), e; }; }); var _b = /^(?:input|select|textarea|button)$/i; n.fn.extend({ prop: function (a, b) { return J(this, n.prop, a, b, arguments.length > 1); }, removeProp: function (a) { return this.each(function () { delete this[n.propFix[a] || a]; }); } }), n.extend({ propFix: { "for": "htmlFor", "class": "className" }, prop: function (a, b, c) { var d, e, f, g = a.nodeType; if (a && 3 !== g && 8 !== g && 2 !== g) return f = 1 !== g || !n.isXMLDoc(a), f && (b = n.propFix[b] || b, e = n.propHooks[b]), void 0 !== c ? e && "set" in e && void 0 !== (d = e.set(a, c, b)) ? d : a[b] = c : e && "get" in e && null !== (d = e.get(a, b)) ? d : a[b]; }, propHooks: { tabIndex: { get: function (a) { return a.hasAttribute("tabindex") || _b.test(a.nodeName) || a.href ? a.tabIndex : -1; } } } }), k.optSelected || (n.propHooks.selected = { get: function (a) { var b = a.parentNode; return b && b.parentNode && b.parentNode.selectedIndex, null; } }), n.each(["tabIndex", "readOnly", "maxLength", "cellSpacing", "cellPadding", "rowSpan", "colSpan", "useMap", "frameBorder", "contentEditable"], function () { n.propFix[this.toLowerCase()] = this; }); var ac = /[\t\r\n\f]/g; n.fn.extend({ addClass: function (a) { var b, c, d, e, f, g, h = "string" == typeof a && a, i = 0, j = this.length; if (n.isFunction(a)) return this.each(function (b) { n(this).addClass(a.call(this, b, this.className)); }); if (h) for (b = (a || "").match(E) || []; j > i; i++)if (c = this[i], d = 1 === c.nodeType && (c.className ? (" " + c.className + " ").replace(ac, " ") : " ")) { f = 0; while (e = b[f++]) d.indexOf(" " + e + " ") < 0 && (d += e + " "); g = n.trim(d), c.className !== g && (c.className = g); } return this; }, removeClass: function (a) { var b, c, d, e, f, g, h = 0 === arguments.length || "string" == typeof a && a, i = 0, j = this.length; if (n.isFunction(a)) return this.each(function (b) { n(this).removeClass(a.call(this, b, this.className)); }); if (h) for (b = (a || "").match(E) || []; j > i; i++)if (c = this[i], d = 1 === c.nodeType && (c.className ? (" " + c.className + " ").replace(ac, " ") : "")) { f = 0; while (e = b[f++]) while (d.indexOf(" " + e + " ") >= 0) d = d.replace(" " + e + " ", " "); g = a ? n.trim(d) : "", c.className !== g && (c.className = g); } return this; }, toggleClass: function (a, b) { var c = typeof a; return "boolean" == typeof b && "string" === c ? b ? this.addClass(a) : this.removeClass(a) : this.each(n.isFunction(a) ? function (c) { n(this).toggleClass(a.call(this, c, this.className, b), b); } : function () { if ("string" === c) { var b, d = 0, e = n(this), f = a.match(E) || []; while (b = f[d++]) e.hasClass(b) ? e.removeClass(b) : e.addClass(b); } else (c === U || "boolean" === c) && (this.className && L.set(this, "__className__", this.className), this.className = this.className || a === !1 ? "" : L.get(this, "__className__") || ""); }); }, hasClass: function (a) { for (var b = " " + a + " ", c = 0, d = this.length; d > c; c++)if (1 === this[c].nodeType && (" " + this[c].className + " ").replace(ac, " ").indexOf(b) >= 0) return !0; return !1; } }); var bc = /\r/g; n.fn.extend({ val: function (a) { var b, c, d, e = this[0]; { if (arguments.length) return d = n.isFunction(a), this.each(function (c) { var e; 1 === this.nodeType && (e = d ? a.call(this, c, n(this).val()) : a, null == e ? e = "" : "number" == typeof e ? e += "" : n.isArray(e) && (e = n.map(e, function (a) { return null == a ? "" : a + ""; })), b = n.valHooks[this.type] || n.valHooks[this.nodeName.toLowerCase()], b && "set" in b && void 0 !== b.set(this, e, "value") || (this.value = e)); }); if (e) return b = n.valHooks[e.type] || n.valHooks[e.nodeName.toLowerCase()], b && "get" in b && void 0 !== (c = b.get(e, "value")) ? c : (c = e.value, "string" == typeof c ? c.replace(bc, "") : null == c ? "" : c); } } }), n.extend({ valHooks: { option: { get: function (a) { var b = n.find.attr(a, "value"); return null != b ? b : n.trim(n.text(a)); } }, select: { get: function (a) { for (var b, c, d = a.options, e = a.selectedIndex, f = "select-one" === a.type || 0 > e, g = f ? null : [], h = f ? e + 1 : d.length, i = 0 > e ? h : f ? e : 0; h > i; i++)if (c = d[i], !(!c.selected && i !== e || (k.optDisabled ? c.disabled : null !== c.getAttribute("disabled")) || c.parentNode.disabled && n.nodeName(c.parentNode, "optgroup"))) { if (b = n(c).val(), f) return b; g.push(b); } return g; }, set: function (a, b) { var c, d, e = a.options, f = n.makeArray(b), g = e.length; while (g--) d = e[g], (d.selected = n.inArray(d.value, f) >= 0) && (c = !0); return c || (a.selectedIndex = -1), f; } } } }), n.each(["radio", "checkbox"], function () { n.valHooks[this] = { set: function (a, b) { return n.isArray(b) ? a.checked = n.inArray(n(a).val(), b) >= 0 : void 0; } }, k.checkOn || (n.valHooks[this].get = function (a) { return null === a.getAttribute("value") ? "on" : a.value; }); }), n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "), function (a, b) { n.fn[b] = function (a, c) { return arguments.length > 0 ? this.on(b, null, a, c) : this.trigger(b); }; }), n.fn.extend({ hover: function (a, b) { return this.mouseenter(a).mouseleave(b || a); }, bind: function (a, b, c) { return this.on(a, null, b, c); }, unbind: function (a, b) { return this.off(a, null, b); }, delegate: function (a, b, c, d) { return this.on(b, a, c, d); }, undelegate: function (a, b, c) { return 1 === arguments.length ? this.off(a, "**") : this.off(b, a || "**", c); } }); var cc = n.now(), dc = /\?/; n.parseJSON = function (a) { return JSON.parse(a + ""); }, n.parseXML = function (a) { var b, c; if (!a || "string" != typeof a) return null; try { c = new DOMParser, b = c.parseFromString(a, "text/xml"); } catch (d) { b = void 0; } return (!b || b.getElementsByTagName("parsererror").length) && n.error("Invalid XML: " + a), b; }; var ec = /#.*$/, fc = /([?&])_=[^&]*/, gc = /^(.*?):[ \t]*([^\r\n]*)$/gm, hc = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/, ic = /^(?:GET|HEAD)$/, jc = /^\/\//, kc = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/, lc = {}, mc = {}, nc = "*/".concat("*"), oc = a.location.href, pc = kc.exec(oc.toLowerCase()) || []; function qc (a) { return function (b, c) { "string" != typeof b && (c = b, b = "*"); var d, e = 0, f = b.toLowerCase().match(E) || []; if (n.isFunction(c)) while (d = f[e++]) "+" === d[0] ? (d = d.slice(1) || "*", (a[d] = a[d] || []).unshift(c)) : (a[d] = a[d] || []).push(c); }; } function rc (a, b, c, d) { var e = {}, f = a === mc; function g (h) { var i; return e[h] = !0, n.each(a[h] || [], function (a, h) { var j = h(b, c, d); return "string" != typeof j || f || e[j] ? f ? !(i = j) : void 0 : (b.dataTypes.unshift(j), g(j), !1); }), i; } return g(b.dataTypes[0]) || !e["*"] && g("*"); } function sc (a, b) { var c, d, e = n.ajaxSettings.flatOptions || {}; for (c in b) void 0 !== b[c] && ((e[c] ? a : d || (d = {}))[c] = b[c]); return d && n.extend(!0, a, d), a; } function tc (a, b, c) { var d, e, f, g, h = a.contents, i = a.dataTypes; while ("*" === i[0]) i.shift(), void 0 === d && (d = a.mimeType || b.getResponseHeader("Content-Type")); if (d) for (e in h) if (h[e] && h[e].test(d)) { i.unshift(e); break; } if (i[0] in c) f = i[0]; else { for (e in c) { if (!i[0] || a.converters[e + " " + i[0]]) { f = e; break; } g || (g = e); } f = f || g; } return f ? (f !== i[0] && i.unshift(f), c[f]) : void 0; } function uc (a, b, c, d) { var e, f, g, h, i, j = {}, k = a.dataTypes.slice(); if (k[1]) for (g in a.converters) j[g.toLowerCase()] = a.converters[g]; f = k.shift(); while (f) if (a.responseFields[f] && (c[a.responseFields[f]] = b), !i && d && a.dataFilter && (b = a.dataFilter(b, a.dataType)), i = f, f = k.shift()) if ("*" === f) f = i; else if ("*" !== i && i !== f) { if (g = j[i + " " + f] || j["* " + f], !g) for (e in j) if (h = e.split(" "), h[1] === f && (g = j[i + " " + h[0]] || j["* " + h[0]])) { g === !0 ? g = j[e] : j[e] !== !0 && (f = h[0], k.unshift(h[1])); break; } if (g !== !0) if (g && a["throws"]) b = g(b); else try { b = g(b); } catch (l) { return { state: "parsererror", error: g ? l : "No conversion from " + i + " to " + f }; } } return { state: "success", data: b }; } n.extend({ active: 0, lastModified: {}, etag: {}, ajaxSettings: { url: oc, type: "GET", isLocal: hc.test(pc[1]), global: !0, processData: !0, async: !0, contentType: "application/x-www-form-urlencoded; charset=UTF-8", accepts: { "*": nc, text: "text/plain", html: "text/html", xml: "application/xml, text/xml", json: "application/json, text/javascript" }, contents: { xml: /xml/, html: /html/, json: /json/ }, responseFields: { xml: "responseXML", text: "responseText", json: "responseJSON" }, converters: { "* text": String, "text html": !0, "text json": n.parseJSON, "text xml": n.parseXML }, flatOptions: { url: !0, context: !0 } }, ajaxSetup: function (a, b) { return b ? sc(sc(a, n.ajaxSettings), b) : sc(n.ajaxSettings, a); }, ajaxPrefilter: qc(lc), ajaxTransport: qc(mc), ajax: function (a, b) { "object" == typeof a && (b = a, a = void 0), b = b || {}; var c, d, e, f, g, h, i, j, k = n.ajaxSetup({}, b), l = k.context || k, m = k.context && (l.nodeType || l.jquery) ? n(l) : n.event, o = n.Deferred(), p = n.Callbacks("once memory"), q = k.statusCode || {}, r = {}, s = {}, t = 0, u = "canceled", v = { readyState: 0, getResponseHeader: function (a) { var b; if (2 === t) { if (!f) { f = {}; while (b = gc.exec(e)) f[b[1].toLowerCase()] = b[2]; } b = f[a.toLowerCase()]; } return null == b ? null : b; }, getAllResponseHeaders: function () { return 2 === t ? e : null; }, setRequestHeader: function (a, b) { var c = a.toLowerCase(); return t || (a = s[c] = s[c] || a, r[a] = b), this; }, overrideMimeType: function (a) { return t || (k.mimeType = a), this; }, statusCode: function (a) { var b; if (a) if (2 > t) for (b in a) q[b] = [q[b], a[b]]; else v.always(a[v.status]); return this; }, abort: function (a) { var b = a || u; return c && c.abort(b), x(0, b), this; } }; if (o.promise(v).complete = p.add, v.success = v.done, v.error = v.fail, k.url = ((a || k.url || oc) + "").replace(ec, "").replace(jc, pc[1] + "//"), k.type = b.method || b.type || k.method || k.type, k.dataTypes = n.trim(k.dataType || "*").toLowerCase().match(E) || [""], null == k.crossDomain && (h = kc.exec(k.url.toLowerCase()), k.crossDomain = !(!h || h[1] === pc[1] && h[2] === pc[2] && (h[3] || ("http:" === h[1] ? "80" : "443")) === (pc[3] || ("http:" === pc[1] ? "80" : "443")))), k.data && k.processData && "string" != typeof k.data && (k.data = n.param(k.data, k.traditional)), rc(lc, k, b, v), 2 === t) return v; i = n.event && k.global, i && 0 === n.active++ && n.event.trigger("ajaxStart"), k.type = k.type.toUpperCase(), k.hasContent = !ic.test(k.type), d = k.url, k.hasContent || (k.data && (d = k.url += (dc.test(d) ? "&" : "?") + k.data, delete k.data), k.cache === !1 && (k.url = fc.test(d) ? d.replace(fc, "$1_=" + cc++) : d + (dc.test(d) ? "&" : "?") + "_=" + cc++)), k.ifModified && (n.lastModified[d] && v.setRequestHeader("If-Modified-Since", n.lastModified[d]), n.etag[d] && v.setRequestHeader("If-None-Match", n.etag[d])), (k.data && k.hasContent && k.contentType !== !1 || b.contentType) && v.setRequestHeader("Content-Type", k.contentType), v.setRequestHeader("Accept", k.dataTypes[0] && k.accepts[k.dataTypes[0]] ? k.accepts[k.dataTypes[0]] + ("*" !== k.dataTypes[0] ? ", " + nc + "; q=0.01" : "") : k.accepts["*"]); for (j in k.headers) v.setRequestHeader(j, k.headers[j]); if (k.beforeSend && (k.beforeSend.call(l, v, k) === !1 || 2 === t)) return v.abort(); u = "abort"; for (j in { success: 1, error: 1, complete: 1 }) v[j](k[j]); if (c = rc(mc, k, b, v)) { v.readyState = 1, i && m.trigger("ajaxSend", [v, k]), k.async && k.timeout > 0 && (g = setTimeout(function () { v.abort("timeout"); }, k.timeout)); try { t = 1, c.send(r, x); } catch (w) { if (!(2 > t)) throw w; x(-1, w); } } else x(-1, "No Transport"); function x (a, b, f, h) { var j, r, s, u, w, x = b; 2 !== t && (t = 2, g && clearTimeout(g), c = void 0, e = h || "", v.readyState = a > 0 ? 4 : 0, j = a >= 200 && 300 > a || 304 === a, f && (u = tc(k, v, f)), u = uc(k, u, v, j), j ? (k.ifModified && (w = v.getResponseHeader("Last-Modified"), w && (n.lastModified[d] = w), w = v.getResponseHeader("etag"), w && (n.etag[d] = w)), 204 === a || "HEAD" === k.type ? x = "nocontent" : 304 === a ? x = "notmodified" : (x = u.state, r = u.data, s = u.error, j = !s)) : (s = x, (a || !x) && (x = "error", 0 > a && (a = 0))), v.status = a, v.statusText = (b || x) + "", j ? o.resolveWith(l, [r, x, v]) : o.rejectWith(l, [v, x, s]), v.statusCode(q), q = void 0, i && m.trigger(j ? "ajaxSuccess" : "ajaxError", [v, k, j ? r : s]), p.fireWith(l, [v, x]), i && (m.trigger("ajaxComplete", [v, k]), --n.active || n.event.trigger("ajaxStop"))); } return v; }, getJSON: function (a, b, c) { return n.get(a, b, c, "json"); }, getScript: function (a, b) { return n.get(a, void 0, b, "script"); } }), n.each(["get", "post"], function (a, b) { n[b] = function (a, c, d, e) { return n.isFunction(c) && (e = e || d, d = c, c = void 0), n.ajax({ url: a, type: b, dataType: e, data: c, success: d }); }; }), n._evalUrl = function (a) { return n.ajax({ url: a, type: "GET", dataType: "script", async: !1, global: !1, "throws": !0 }); }, n.fn.extend({ wrapAll: function (a) { var b; return n.isFunction(a) ? this.each(function (b) { n(this).wrapAll(a.call(this, b)); }) : (this[0] && (b = n(a, this[0].ownerDocument).eq(0).clone(!0), this[0].parentNode && b.insertBefore(this[0]), b.map(function () { var a = this; while (a.firstElementChild) a = a.firstElementChild; return a; }).append(this)), this); }, wrapInner: function (a) { return this.each(n.isFunction(a) ? function (b) { n(this).wrapInner(a.call(this, b)); } : function () { var b = n(this), c = b.contents(); c.length ? c.wrapAll(a) : b.append(a); }); }, wrap: function (a) { var b = n.isFunction(a); return this.each(function (c) { n(this).wrapAll(b ? a.call(this, c) : a); }); }, unwrap: function () { return this.parent().each(function () { n.nodeName(this, "body") || n(this).replaceWith(this.childNodes); }).end(); } }), n.expr.filters.hidden = function (a) { return a.offsetWidth <= 0 && a.offsetHeight <= 0; }, n.expr.filters.visible = function (a) { return !n.expr.filters.hidden(a); }; var vc = /%20/g, wc = /\[\]$/, xc = /\r?\n/g, yc = /^(?:submit|button|image|reset|file)$/i, zc = /^(?:input|select|textarea|keygen)/i; function Ac (a, b, c, d) { var e; if (n.isArray(b)) n.each(b, function (b, e) { c || wc.test(a) ? d(a, e) : Ac(a + "[" + ("object" == typeof e ? b : "") + "]", e, c, d); }); else if (c || "object" !== n.type(b)) d(a, b); else for (e in b) Ac(a + "[" + e + "]", b[e], c, d); } n.param = function (a, b) { var c, d = [], e = function (a, b) { b = n.isFunction(b) ? b() : null == b ? "" : b, d[d.length] = encodeURIComponent(a) + "=" + encodeURIComponent(b); }; if (void 0 === b && (b = n.ajaxSettings && n.ajaxSettings.traditional), n.isArray(a) || a.jquery && !n.isPlainObject(a)) n.each(a, function () { e(this.name, this.value); }); else for (c in a) Ac(c, a[c], b, e); return d.join("&").replace(vc, "+"); }, n.fn.extend({ serialize: function () { return n.param(this.serializeArray()); }, serializeArray: function () { return this.map(function () { var a = n.prop(this, "elements"); return a ? n.makeArray(a) : this; }).filter(function () { var a = this.type; return this.name && !n(this).is(":disabled") && zc.test(this.nodeName) && !yc.test(a) && (this.checked || !T.test(a)); }).map(function (a, b) { var c = n(this).val(); return null == c ? null : n.isArray(c) ? n.map(c, function (a) { return { name: b.name, value: a.replace(xc, "\r\n") }; }) : { name: b.name, value: c.replace(xc, "\r\n") }; }).get(); } }), n.ajaxSettings.xhr = function () { try { return new XMLHttpRequest; } catch (a) { } }; var Bc = 0, Cc = {}, Dc = { 0: 200, 1223: 204 }, Ec = n.ajaxSettings.xhr(); a.attachEvent && a.attachEvent("onunload", function () { for (var a in Cc) Cc[a](); }), k.cors = !!Ec && "withCredentials" in Ec, k.ajax = Ec = !!Ec, n.ajaxTransport(function (a) { var b; return k.cors || Ec && !a.crossDomain ? { send: function (c, d) { var e, f = a.xhr(), g = ++Bc; if (f.open(a.type, a.url, a.async, a.username, a.password), a.xhrFields) for (e in a.xhrFields) f[e] = a.xhrFields[e]; a.mimeType && f.overrideMimeType && f.overrideMimeType(a.mimeType), a.crossDomain || c["X-Requested-With"] || (c["X-Requested-With"] = "XMLHttpRequest"); for (e in c) f.setRequestHeader(e, c[e]); b = function (a) { return function () { b && (delete Cc[g], b = f.onload = f.onerror = null, "abort" === a ? f.abort() : "error" === a ? d(f.status, f.statusText) : d(Dc[f.status] || f.status, f.statusText, "string" == typeof f.responseText ? { text: f.responseText } : void 0, f.getAllResponseHeaders())); }; }, f.onload = b(), f.onerror = b("error"), b = Cc[g] = b("abort"); try { f.send(a.hasContent && a.data || null); } catch (h) { if (b) throw h; } }, abort: function () { b && b(); } } : void 0; }), n.ajaxSetup({ accepts: { script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript" }, contents: { script: /(?:java|ecma)script/ }, converters: { "text script": function (a) { return n.globalEval(a), a; } } }), n.ajaxPrefilter("script", function (a) { void 0 === a.cache && (a.cache = !1), a.crossDomain && (a.type = "GET"); }), n.ajaxTransport("script", function (a) { if (a.crossDomain) { var b, c; return { send: function (d, e) { b = n("<script>").prop({ async: !0, charset: a.scriptCharset, src: a.url }).on("load error", c = function (a) { b.remove(), c = null, a && e("error" === a.type ? 404 : 200, a.type); }), l.head.appendChild(b[0]); }, abort: function () { c && c(); } }; } }); var Fc = [], Gc = /(=)\?(?=&|$)|\?\?/; n.ajaxSetup({ jsonp: "callback", jsonpCallback: function () { var a = Fc.pop() || n.expando + "_" + cc++; return this[a] = !0, a; } }), n.ajaxPrefilter("json jsonp", function (b, c, d) { var e, f, g, h = b.jsonp !== !1 && (Gc.test(b.url) ? "url" : "string" == typeof b.data && !(b.contentType || "").indexOf("application/x-www-form-urlencoded") && Gc.test(b.data) && "data"); return h || "jsonp" === b.dataTypes[0] ? (e = b.jsonpCallback = n.isFunction(b.jsonpCallback) ? b.jsonpCallback() : b.jsonpCallback, h ? b[h] = b[h].replace(Gc, "$1" + e) : b.jsonp !== !1 && (b.url += (dc.test(b.url) ? "&" : "?") + b.jsonp + "=" + e), b.converters["script json"] = function () { return g || n.error(e + " was not called"), g[0]; }, b.dataTypes[0] = "json", f = a[e], a[e] = function () { g = arguments; }, d.always(function () { a[e] = f, b[e] && (b.jsonpCallback = c.jsonpCallback, Fc.push(e)), g && n.isFunction(f) && f(g[0]), g = f = void 0; }), "script") : void 0; }), n.parseHTML = function (a, b, c) { if (!a || "string" != typeof a) return null; "boolean" == typeof b && (c = b, b = !1), b = b || l; var d = v.exec(a), e = !c && []; return d ? [b.createElement(d[1])] : (d = n.buildFragment([a], b, e), e && e.length && n(e).remove(), n.merge([], d.childNodes)); }; var Hc = n.fn.load; n.fn.load = function (a, b, c) { if ("string" != typeof a && Hc) return Hc.apply(this, arguments); var d, e, f, g = this, h = a.indexOf(" "); return h >= 0 && (d = n.trim(a.slice(h)), a = a.slice(0, h)), n.isFunction(b) ? (c = b, b = void 0) : b && "object" == typeof b && (e = "POST"), g.length > 0 && n.ajax({ url: a, type: e, dataType: "html", data: b }).done(function (a) { f = arguments, g.html(d ? n("<div>").append(n.parseHTML(a)).find(d) : a); }).complete(c && function (a, b) { g.each(c, f || [a.responseText, b, a]); }), this; }, n.each(["ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend"], function (a, b) { n.fn[b] = function (a) { return this.on(b, a); }; }), n.expr.filters.animated = function (a) { return n.grep(n.timers, function (b) { return a === b.elem; }).length; }; var Ic = a.document.documentElement; function Jc (a) { return n.isWindow(a) ? a : 9 === a.nodeType && a.defaultView; } n.offset = { setOffset: function (a, b, c) { var d, e, f, g, h, i, j, k = n.css(a, "position"), l = n(a), m = {}; "static" === k && (a.style.position = "relative"), h = l.offset(), f = n.css(a, "top"), i = n.css(a, "left"), j = ("absolute" === k || "fixed" === k) && (f + i).indexOf("auto") > -1, j ? (d = l.position(), g = d.top, e = d.left) : (g = parseFloat(f) || 0, e = parseFloat(i) || 0), n.isFunction(b) && (b = b.call(a, c, h)), null != b.top && (m.top = b.top - h.top + g), null != b.left && (m.left = b.left - h.left + e), "using" in b ? b.using.call(a, m) : l.css(m); } }, n.fn.extend({ offset: function (a) { if (arguments.length) return void 0 === a ? this : this.each(function (b) { n.offset.setOffset(this, a, b); }); var b, c, d = this[0], e = { top: 0, left: 0 }, f = d && d.ownerDocument; if (f) return b = f.documentElement, n.contains(b, d) ? (typeof d.getBoundingClientRect !== U && (e = d.getBoundingClientRect()), c = Jc(f), { top: e.top + c.pageYOffset - b.clientTop, left: e.left + c.pageXOffset - b.clientLeft }) : e; }, position: function () { if (this[0]) { var a, b, c = this[0], d = { top: 0, left: 0 }; return "fixed" === n.css(c, "position") ? b = c.getBoundingClientRect() : (a = this.offsetParent(), b = this.offset(), n.nodeName(a[0], "html") || (d = a.offset()), d.top += n.css(a[0], "borderTopWidth", !0), d.left += n.css(a[0], "borderLeftWidth", !0)), { top: b.top - d.top - n.css(c, "marginTop", !0), left: b.left - d.left - n.css(c, "marginLeft", !0) }; } }, offsetParent: function () { return this.map(function () { var a = this.offsetParent || Ic; while (a && !n.nodeName(a, "html") && "static" === n.css(a, "position")) a = a.offsetParent; return a || Ic; }); } }), n.each({ scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function (b, c) { var d = "pageYOffset" === c; n.fn[b] = function (e) { return J(this, function (b, e, f) { var g = Jc(b); return void 0 === f ? g ? g[c] : b[e] : void (g ? g.scrollTo(d ? a.pageXOffset : f, d ? f : a.pageYOffset) : b[e] = f); }, b, e, arguments.length, null); }; }), n.each(["top", "left"], function (a, b) { n.cssHooks[b] = yb(k.pixelPosition, function (a, c) { return c ? (c = xb(a, b), vb.test(c) ? n(a).position()[b] + "px" : c) : void 0; }); }), n.each({ Height: "height", Width: "width" }, function (a, b) { n.each({ padding: "inner" + a, content: b, "": "outer" + a }, function (c, d) { n.fn[d] = function (d, e) { var f = arguments.length && (c || "boolean" != typeof d), g = c || (d === !0 || e === !0 ? "margin" : "border"); return J(this, function (b, c, d) { var e; return n.isWindow(b) ? b.document.documentElement["client" + a] : 9 === b.nodeType ? (e = b.documentElement, Math.max(b.body["scroll" + a], e["scroll" + a], b.body["offset" + a], e["offset" + a], e["client" + a])) : void 0 === d ? n.css(b, c, g) : n.style(b, c, d, g); }, b, f ? d : void 0, f, null); }; }); }), n.fn.size = function () { return this.length; }, n.fn.andSelf = n.fn.addBack, "function" == typeof define && define.amd && define("jquery", [], function () { return n; }); var Kc = a.jQuery, Lc = a.$; return n.noConflict = function (b) { return a.$ === n && (a.$ = Lc), b && a.jQuery === n && (a.jQuery = Kc), n; }, typeof b === U && (a.jQuery = a.$ = n), n;
});


// Ion.Sound | version 3.0.0 | https://github.com/IonDen/ion.sound
/*
MIT licence
Copyright (C) 2014 by Denis Ineshin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function (l, e, n, r)
{
    l.ion = l.ion || {}; if (!ion.sound)
    {
        var m = function (a) { a || (a = "undefined"); if (l.console) { console.warn && "function" === typeof console.warn ? console.warn(a) : console.log && "function" === typeof console.log && console.log(a); var g = n("#debug"); if (g.length) { var b = g.html(); g.html(b + a + "<br/>"); } } }, f = function (a, b) { var c; b = b || {}; for (c in a) a.hasOwnProperty(c) && (b[c] = a[c]); return b; }; if ("function" !== typeof Audio && "object" !== typeof Audio) e = function () { m("HTML5 Audio is not supported in this browser"); }, ion.sound =
            e, ion.sound.play = e, ion.sound.stop = e, ion.sound.pause = e, ion.sound.preload = e, ion.sound.destroy = e, e(); else
        {
            e = /iPad|iPhone|iPod/.test(e.appVersion); var q = 0, c = {}, d = {}, b; !c.supported && e ? c.supported = ["mp3", "mp4", "aac"] : c.supported || (c.supported = ["mp3", "ogg", "mp4", "aac", "wav"]); ion.sound = function (a)
            {
                f(a, c); c.path = c.path || ""; c.volume = c.volume || 1; c.preload = c.preload || !1; c.multiplay = c.multiplay || !1; c.loop = c.loop || !1; c.sprite = c.sprite || null; c.scope = c.scope || null; c.ready_callback = c.ready_callback || null; c.ended_callback =
                    c.ended_callback || null; if (q = c.sounds.length) for (b = 0; b < q; b++) { if (!d[b]) { a = c.sounds[b]; var g = a.alias || a.name; d[g] || (d[g] = new p(a), d[g].init()); } } else m("No sound-files provided!");
            }; ion.sound.VERSION = "3.0.0"; ion.sound._method = function (a, c, e) { if (c) d[c] && d[c][a](e); else for (b in d) if (d.hasOwnProperty(b)) d[b][a](e); }; ion.sound.preload = function (a, b) { b = b || {}; f({ preload: !0 }, b); ion.sound._method("init", a, b); }; ion.sound.destroy = function (a)
            {
                ion.sound._method("destroy", a); if (a) d[a] = null; else for (b in d) d.hasOwnProperty(b) &&
                    d[b] && (d[b] = null);
            }; ion.sound.play = function (a, b) { ion.sound._method("play", a, b); }; ion.sound.stop = function (a, b) { ion.sound._method("stop", a, b); }; ion.sound.pause = function (a, b) { ion.sound._method("pause", a, b); }; n && (n.ionSound = ion.sound); e = l.AudioContext || l.webkitAudioContext; var h; e && (h = new e); var p = function (a) { this.options = f(c); delete this.options.sounds; f(a, this.options); this.request = null; this.streams = {}; this.result = {}; this.ext = 0; this.url = ""; this.autoplay = this.no_file = this.decoded = this.loaded = !1; }; p.prototype =
            {
                init: function (a) { a && f(a, this.options); this.options.preload && this.load(); }, destroy: function () { var a; for (b in this.streams) (a = this.streams[b]) && a.destroy(); this.streams = {}; this.result = null; this.options = this.options.buffer = null; this.request && (this.request.removeEventListener("load", this.ready.bind(this), !1), this.request.removeEventListener("error", this.error.bind(this), !1), this.request.abort(), this.request = null); }, createUrl: function ()
                {
                    this.url = this.options.path + this.options.name + "." + this.options.supported[this.ext] +
                        "?" + (new Date).valueOf();
                }, load: function () { this.no_file ? m('No sources for "' + this.options.name + '" sound :(') : (this.createUrl(), this.request = new XMLHttpRequest, this.request.open("GET", this.url, !0), this.request.responseType = "arraybuffer", this.request.addEventListener("load", this.ready.bind(this), !1), this.request.addEventListener("error", this.error.bind(this), !1), this.request.send()); }, reload: function ()
                {
                    this.ext++; this.options.supported[this.ext] ? this.load() : (this.no_file = !0, m('No sources for "' + this.options.name +
                        '" sound :('));
                }, ready: function (a) { this.result = a.target; 4 !== this.result.readyState ? this.reload() : 200 !== this.result.status ? (m(this.url + " was not found on server!"), this.reload()) : (this.request.removeEventListener("load", this.ready.bind(this), !1), this.request.removeEventListener("error", this.error.bind(this), !1), this.request = null, this.loaded = !0, this.decode()); }, decode: function () { h && h.decodeAudioData(this.result.response, this.setBuffer.bind(this), this.error.bind(this)); }, setBuffer: function (a)
                {
                    this.options.buffer =
                    a; this.decoded = !0; a = { name: this.options.name, alias: this.options.alias, ext: this.options.supported[this.ext], duration: this.options.buffer.duration }; this.options.ready_callback && "function" === typeof this.options.ready_callback && this.options.ready_callback.call(this.options.scope, a); if (this.options.sprite) for (b in this.options.sprite) this.options.start = this.options.sprite[b][0], this.options.end = this.options.sprite[b][1], this.streams[b] = new k(this.options, b); else this.streams[0] = new k(this.options); this.autoplay &&
                        (this.autoplay = !1, this.play());
                }, error: function () { this.reload(); }, play: function (a) { delete this.options.part; a && f(a, this.options); if (!this.loaded) this.options.preload || (this.autoplay = !0, this.load()); else if (!this.no_file && this.decoded) if (this.options.sprite) if (this.options.part) this.streams[this.options.part].play(this.options); else for (b in this.options.sprite) this.streams[b].play(this.options); else this.streams[0].play(this.options); }, stop: function (a)
                {
                    if (this.options.sprite) if (a) this.streams[a.part].stop();
                    else for (b in this.options.sprite) this.streams[b].stop(); else this.streams[0].stop();
                }, pause: function (a) { if (this.options.sprite) if (a) this.streams[a.part].pause(); else for (b in this.options.sprite) this.streams[b].pause(); else this.streams[0].pause(); }
            }; var k = function (a, b)
            {
                this.alias = a.alias; this.name = a.name; this.sprite_part = b; this.buffer = a.buffer; this.start = a.start || 0; this.end = a.end || this.buffer.duration; this.multiplay = a.multiplay || !1; this.volume = a.volume || 1; this.scope = a.scope; this.ended_callback = a.ended_callback;
                this.setLoop(a); this.gain = this.source = null; this.paused = this.playing = !1; this.time_offset = this.time_played = this.time_ended = this.time_started = 0;
            }; k.prototype = {
                destroy: function () { this.stop(); this.source = this.buffer = null; this.gain && this.gain.disconnect(); this.source && this.source.disconnect(); this.source = this.gain = null; }, setLoop: function (a) { !0 === a.loop ? this.loop = 9999999 : "number" === typeof a.loop && (this.loop = +a.loop - 1); }, update: function (a) { this.setLoop(a); "volume" in a && (this.volume = a.volume); }, play: function (a)
                {
                    a &&
                    this.update(a); if (this.multiplay || !this.playing) this.gain = h.createGain(), this.source = h.createBufferSource(), this.source.buffer = this.buffer, this.source.connect(this.gain), this.gain.connect(h.destination), this.gain.gain.value = this.volume, this.source.onended = this.ended.bind(this), this._play();
                }, _play: function ()
                {
                    var a, b; this.paused ? (a = this.start + this.time_offset, b = this.end - this.time_offset) : (a = this.start, b = this.end); 0 >= b ? this.clear() : (this.source.start(0, a, b), this.playing = !0, this.paused = !1, this.time_started =
                        (new Date).valueOf());
                }, stop: function () { this.source && this.source.stop(0); this.clear(); }, pause: function () { this.paused ? this.play() : this.playing && (this.source && this.source.stop(0), this.paused = !0); }, ended: function () { this.playing = !1; this.time_ended = (new Date).valueOf(); this.time_played = (this.time_ended - this.time_started) / 1E3; this.time_offset += this.time_played; if (this.time_offset >= this.end || .015 > this.end - this.time_offset) this._ended(), this.clear(), this.loop && (this.loop--, this.play()); }, _ended: function ()
                {
                    var a =
                        { name: this.name, alias: this.alias, part: this.sprite_part, start: this.start, duration: this.end }; this.ended_callback && "function" === typeof this.ended_callback && this.ended_callback.call(this.scope, a);
                }, clear: function () { this.time_offset = this.time_played = 0; this.playing = this.paused = !1; }
            }; h || (function ()
            {
                var a = new Audio, b = a.canPlayType("audio/mpeg"), e = a.canPlayType("audio/ogg"), a = a.canPlayType('audio/mp4; codecs="mp4a.40.2"'), d, f; for (f = 0; f < c.supported.length; f++)d = c.supported[f], b || "mp3" !== d || c.supported.splice(f,
                    1), e || "ogg" !== d || c.supported.splice(f, 1), a || "aac" !== d || c.supported.splice(f, 1), a || "mp4" !== d || c.supported.splice(f, 1);
            }(), p.prototype = {
                init: function (a) { a && f(a, this.options); this.inited = !0; this.options.preload && this.load(); }, destroy: function () { var a; for (b in this.streams) (a = this.streams[b]) && a.destroy(); this.streams = {}; this.inited = this.loaded = !1; }, load: function ()
                {
                    var a; this.options.preload = !0; this.options._ready = this.ready; this.options._scope = this; if (this.options.sprite) for (b in this.options.sprite) a =
                        this.options.sprite[b], this.options.start = a[0], this.options.end = a[1], this.streams[b] = new k(this.options, b); else this.streams[0] = new k(this.options);
                }, ready: function (a) { this.loaded || (this.loaded = !0, a = { name: this.options.name, alias: this.options.alias, ext: this.options.supported[this.ext], duration: a }, this.options.ready_callback && "function" === typeof this.options.ready_callback && this.options.ready_callback.call(this.options.scope, a), this.autoplay && (this.autoplay = !1, this.play())); }, play: function (a)
                {
                    if (this.inited) if (delete this.options.part,
                        a && f(a, this.options), this.loaded) if (this.options.sprite) if (this.options.part) this.streams[this.options.part].play(this.options); else for (b in this.options.sprite) this.streams[b].play(this.options); else this.streams[0].play(this.options); else this.options.preload || (this.autoplay = !0, this.load());
                }, stop: function (a) { if (this.inited) if (this.options.sprite) if (a) this.streams[a.part].stop(); else for (b in this.options.sprite) this.streams[b].stop(); else this.streams[0].stop(); }, pause: function (a)
                {
                    if (this.inited) if (this.options.sprite) if (a) this.streams[a.part].pause();
                    else for (b in this.options.sprite) this.streams[b].pause(); else this.streams[0].pause();
                }
            }, k = function (a, b) { this.name = a.name; this.alias = a.alias; this.sprite_part = b; this.multiplay = a.multiplay; this.volume = a.volume; this.preload = a.preload; this.path = c.path; this.start = a.start || 0; this.end = a.end || 0; this.scope = a.scope; this.ended_callback = a.ended_callback; this._scope = a._scope; this._ready = a._ready; this.setLoop(a); this.url = this.sound = null; this.loaded = !1; this.played_time = this.paused_time = this.start_time = 0; this.init(); },
                k.prototype = {
                    init: function () { this.sound = new Audio; this.sound.volume = this.volume; this.createUrl(); this.sound.addEventListener("ended", this.ended.bind(this), !1); this.sound.addEventListener("canplaythrough", this.can_play_through.bind(this), !1); this.sound.addEventListener("timeupdate", this._update.bind(this), !1); this.load(); }, destroy: function ()
                    {
                        this.stop(); this.sound.removeEventListener("ended", this.ended.bind(this), !1); this.sound.removeEventListener("canplaythrough", this.can_play_through.bind(this), !1);
                        this.sound.removeEventListener("timeupdate", this._update.bind(this), !1); this.sound = null; this.loaded = !1;
                    }, createUrl: function () { this.url = this.path + this.name + "." + c.supported[0] + "?" + (new Date).valueOf(); }, can_play_through: function () { this.preload && this.ready(); }, load: function () { this.sound.src = this.url; this.sound.preload = this.preload ? "auto" : "none"; this.preload && this.sound.load(); }, setLoop: function (a) { !0 === a.loop ? this.loop = 9999999 : "number" === typeof a.loop && (this.loop = +a.loop - 1); }, update: function (a)
                    {
                        this.setLoop(a);
                        "volume" in a && (this.volume = a.volume);
                    }, ready: function () { !this.loaded && this.sound && (this.loaded = !0, this._ready.call(this._scope, this.sound.duration), this.end || (this.end = this.sound.duration)); }, play: function (a) { a && this.update(a); !this.multiplay && this.playing || this._play(); }, _play: function () { if (this.paused) this.paused = !1; else try { this.sound.currentTime = this.start; } catch (a) { } this.playing = !0; this.start_time = (new Date).valueOf(); this.sound.volume = this.volume; this.sound.play(); }, stop: function ()
                    {
                        if (this.playing)
                        {
                            this.paused =
                            this.playing = !1; this.sound.pause(); this.clear(); try { this.sound.currentTime = this.start; } catch (a) { }
                        }
                    }, pause: function () { this.paused ? this._play() : (this.playing = !1, this.paused = !0, this.sound.pause(), this.paused_time = (new Date).valueOf(), this.played_time += this.paused_time - this.start_time); }, _update: function () { this.start_time && (this.played_time + ((new Date).valueOf() - this.start_time)) / 1E3 >= this.end && this.playing && (this.stop(), this._ended()); }, ended: function () { this.playing && (this.stop(), this._ended()); }, _ended: function ()
                    {
                        this.playing =
                        !1; var a = { name: this.name, alias: this.alias, part: this.sprite_part, start: this.start, duration: this.end }; this.ended_callback && "function" === typeof this.ended_callback && this.ended_callback.call(this.scope, a); this.loop && setTimeout(this.looper.bind(this), 15);
                    }, looper: function () { this.loop--; this.play(); }, clear: function () { this.paused_time = this.played_time = this.start_time = 0; }
                });
        }
    }
})(window, navigator, jQuery || $);

//TWEENJS
var TWEEN = TWEEN || function () { var n = []; return { getAll: function () { return n; }, removeAll: function () { n = []; }, add: function (t) { n.push(t); }, remove: function (t) { var r = n.indexOf(t); -1 !== r && n.splice(r, 1); }, update: function (t, r) { if (0 === n.length) return !1; var i = 0; for (t = void 0 !== t ? t : TWEEN.now(); i < n.length;)n[i].update(t) || r ? i++ : n.splice(i, 1); return !0; } }; }(); !function () { void 0 === this.window && void 0 !== this.process ? TWEEN.now = function () { var n = process.hrtime(); return 1e3 * n[0] + n[1] / 1e3; } : void 0 !== this.window && void 0 !== window.performance && void 0 !== window.performance.now ? TWEEN.now = window.performance.now.bind(window.performance) : void 0 !== Date.now ? TWEEN.now = Date.now : TWEEN.now = function () { return (new Date).getTime(); }; }(), TWEEN.Tween = function (n) { var t = n, r = {}, i = {}, o = {}, u = 1e3, e = 0, a = !1, f = !1, c = !1, s = 0, h = null, l = TWEEN.Easing.Linear.None, E = TWEEN.Interpolation.Linear, p = [], d = null, v = !1, w = null, I = null, M = null, C = null, S = null, ST = null; for (var T in n) r[T] = parseFloat(n[T], 10); this.to = function (n, t) { return void 0 !== t && (u = t), i = n, this; }, this.start = function (n) { TWEEN.add(this), f = !0, v = !1, h = void 0 !== n ? n : TWEEN.now(), h += s; for (var u in i) { if (i[u] instanceof Array) { if (0 === i[u].length) continue; i[u] = [t[u]].concat(i[u]); } void 0 !== r[u] && (r[u] = t[u], r[u] instanceof Array == !1 && (r[u] *= 1), o[u] = r[u] || 0); } return this; }, this.stop = function () { return f ? (TWEEN.remove(this), f = !1, null !== M && M.call(S), this.stopChainedTweens(), this) : this; }, this.stopChainedTweens = function () { for (var n = 0, t = p.length; t > n; n++)p[n].stop(); }, this.delay = function (n) { return s = n, this; }, this.repeat = function (n) { return e = n, this; }, this.yoyo = function (n) { return a = n, this; }, this.easing = function (n) { return l = n, this; }, this.interpolation = function (n) { return E = n, this; }, this.chain = function () { return p = arguments, this; }, this.onStart = function (n, c) { return d = n, ST = c, this; }, this.onUpdate = function (n) { return w = n, this; }, this.onComplete = function (n, c) { return I = n, C = c, this; }, this.onStop = function (n, c) { return M = n, S = c, this; }, this.update = function (n) { var f, M, T; if (h > n) return !0; v === !1 && (null !== d && d.call(ST), v = !0), M = (n - h) / u, M = M > 1 ? 1 : M, T = l(M); for (f in i) if (void 0 !== r[f]) { var N = r[f] || 0, W = i[f]; W instanceof Array ? t[f] = E(W, T) : ("string" == typeof W && (W = "+" === W.charAt(0) || "-" === W.charAt(0) ? N + parseFloat(W, 10) : parseFloat(W, 10)), "number" == typeof W && (t[f] = N + (W - N) * T)); } if (null !== w && w.call(t, T), 1 === M) { if (e > 0) { isFinite(e) && e--; for (f in o) { if ("string" == typeof i[f] && (o[f] = o[f] + parseFloat(i[f], 10)), a) { var O = o[f]; o[f] = i[f], i[f] = O; } r[f] = o[f]; } return a && (c = !c), h = n + s, !0; } null !== I && I.call(C); for (var m = 0, g = p.length; g > m; m++)p[m].start(h + u); return !1; } return !0; }; }, TWEEN.Easing = { Linear: { None: function (n) { return n; } }, Quadratic: { In: function (n) { return n * n; }, Out: function (n) { return n * (2 - n); }, InOut: function (n) { return (n *= 2) < 1 ? .5 * n * n : -.5 * (--n * (n - 2) - 1); } }, Cubic: { In: function (n) { return n * n * n; }, Out: function (n) { return --n * n * n + 1; }, InOut: function (n) { return (n *= 2) < 1 ? .5 * n * n * n : .5 * ((n -= 2) * n * n + 2); } }, Quartic: { In: function (n) { return n * n * n * n; }, Out: function (n) { return 1 - --n * n * n * n; }, InOut: function (n) { return (n *= 2) < 1 ? .5 * n * n * n * n : -.5 * ((n -= 2) * n * n * n - 2); } }, Quintic: { In: function (n) { return n * n * n * n * n; }, Out: function (n) { return --n * n * n * n * n + 1; }, InOut: function (n) { return (n *= 2) < 1 ? .5 * n * n * n * n * n : .5 * ((n -= 2) * n * n * n * n + 2); } }, Sinusoidal: { In: function (n) { return 1 - Math.cos(n * Math.PI / 2); }, Out: function (n) { return Math.sin(n * Math.PI / 2); }, InOut: function (n) { return .5 * (1 - Math.cos(Math.PI * n)); } }, Exponential: { In: function (n) { return 0 === n ? 0 : Math.pow(1024, n - 1); }, Out: function (n) { return 1 === n ? 1 : 1 - Math.pow(2, -10 * n); }, InOut: function (n) { return 0 === n ? 0 : 1 === n ? 1 : (n *= 2) < 1 ? .5 * Math.pow(1024, n - 1) : .5 * (-Math.pow(2, -10 * (n - 1)) + 2); } }, Circular: { In: function (n) { return 1 - Math.sqrt(1 - n * n); }, Out: function (n) { return Math.sqrt(1 - --n * n); }, InOut: function (n) { return (n *= 2) < 1 ? -.5 * (Math.sqrt(1 - n * n) - 1) : .5 * (Math.sqrt(1 - (n -= 2) * n) + 1); } }, Elastic: { In: function (n) { return 0 === n ? 0 : 1 === n ? 1 : -Math.pow(2, 10 * (n - 1)) * Math.sin(5 * (n - 1.1) * Math.PI); }, Out: function (n) { return 0 === n ? 0 : 1 === n ? 1 : Math.pow(2, -10 * n) * Math.sin(5 * (n - .1) * Math.PI) + 1; }, InOut: function (n) { return 0 === n ? 0 : 1 === n ? 1 : (n *= 2, 1 > n ? -.5 * Math.pow(2, 10 * (n - 1)) * Math.sin(5 * (n - 1.1) * Math.PI) : .5 * Math.pow(2, -10 * (n - 1)) * Math.sin(5 * (n - 1.1) * Math.PI) + 1); } }, Back: { In: function (n) { var t = 1.70158; return n * n * ((t + 1) * n - t); }, Out: function (n) { var t = 1.70158; return --n * n * ((t + 1) * n + t) + 1; }, InOut: function (n) { var t = 2.5949095; return (n *= 2) < 1 ? .5 * (n * n * ((t + 1) * n - t)) : .5 * ((n -= 2) * n * ((t + 1) * n + t) + 2); } }, Bounce: { In: function (n) { return 1 - TWEEN.Easing.Bounce.Out(1 - n); }, Out: function (n) { return 1 / 2.75 > n ? 7.5625 * n * n : 2 / 2.75 > n ? 7.5625 * (n -= 1.5 / 2.75) * n + .75 : 2.5 / 2.75 > n ? 7.5625 * (n -= 2.25 / 2.75) * n + .9375 : 7.5625 * (n -= 2.625 / 2.75) * n + .984375; }, InOut: function (n) { return .5 > n ? .5 * TWEEN.Easing.Bounce.In(2 * n) : .5 * TWEEN.Easing.Bounce.Out(2 * n - 1) + .5; } } }, TWEEN.Interpolation = { Linear: function (n, t) { var r = n.length - 1, i = r * t, o = Math.floor(i), u = TWEEN.Interpolation.Utils.Linear; return 0 > t ? u(n[0], n[1], i) : t > 1 ? u(n[r], n[r - 1], r - i) : u(n[o], n[o + 1 > r ? r : o + 1], i - o); }, Bezier: function (n, t) { for (var r = 0, i = n.length - 1, o = Math.pow, u = TWEEN.Interpolation.Utils.Bernstein, e = 0; i >= e; e++)r += o(1 - t, i - e) * o(t, e) * n[e] * u(i, e); return r; }, CatmullRom: function (n, t) { var r = n.length - 1, i = r * t, o = Math.floor(i), u = TWEEN.Interpolation.Utils.CatmullRom; return n[0] === n[r] ? (0 > t && (o = Math.floor(i = r * (1 + t))), u(n[(o - 1 + r) % r], n[o], n[(o + 1) % r], n[(o + 2) % r], i - o)) : 0 > t ? n[0] - (u(n[0], n[0], n[1], n[1], -i) - n[0]) : t > 1 ? n[r] - (u(n[r], n[r], n[r - 1], n[r - 1], i - r) - n[r]) : u(n[o ? o - 1 : 0], n[o], n[o + 1 > r ? r : o + 1], n[o + 2 > r ? r : o + 2], i - o); }, Utils: { Linear: function (n, t, r) { return (t - n) * r + n; }, Bernstein: function (n, t) { var r = TWEEN.Interpolation.Utils.Factorial; return r(n) / r(t) / r(n - t); }, Factorial: function () { var n = [1]; return function (t) { var r = 1; if (n[t]) return n[t]; for (var i = t; i > 1; i--)r *= i; return n[t] = r, r; }; }(), CatmullRom: function (n, t, r, i, o) { var u = .5 * (r - n), e = .5 * (i - t), a = o * o, f = o * a; return (2 * t - 2 * r + u + e) * f + (-3 * t + 3 * r - 2 * u - e) * a + u * o + t; } } }, function (n) { "function" == typeof define && define.amd ? define([], function () { return TWEEN; }) : "undefined" != typeof module && "object" == typeof exports ? module.exports = TWEEN : void 0 !== n && (n.TWEEN = TWEEN); }(this);
/*
 * End File:
 * ./framework/extensions/thirdparty.js
 */ 

/*
 * Start File:
 * ./framework/util/audio.js
 */ 
var GameAudio =
{
	active: false,

	init: function (collection, containingFolder)
	{
		console.log("GAME: Loading sounds. (Note: Only supported from online-source, will fail when executed on local files.)");

		try 
		{
			var soundColl = [];

			for (var i = 0; i < collection.length; i++)
			{
				collection[i].preload = true;

				soundColl.push(collection[i]);
			}

			if (containingFolder == null)
				containingFolder = "";

			if (containingFolder != "")
				containingFolder += "/";

			ion.sound
				({
					sounds: soundColl,
					volume: 1,
					preload: true,
					multiplay: true,
					path: containingFolder
				});

			this.active = true;
		}
		catch (err) 
		{
			console.log("GAME: ERROR: Sounds could not be loaded. Sound will not be available.");
		}
	},

	play: function (name)
	{
		if (this.active)
			ion.sound.play(name);
	}
};
/*
 * End File:
 * ./framework/util/audio.js
 */ 

/*
 * Start File:
 * ./framework/util/cookie.js
 */ 
var CookieManager =
{
    setCookie: function (cname, cvalue, exdays = 365) 
    {
        const d = new Date();

        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();

        let newCookie = cname + "=" + cvalue + ";" + expires + ";path=kiop/";
        document.cookie = newCookie;
    },

    getCookie: function (cname) 
    {
        let name = cname + "=";
        let ca = document.cookie.split(';');

        for (let i = 0; i < ca.length; i++) 
        {
            let c = ca[i];

            while (c.charAt(0) == ' ') 
            {
                c = c.substring(1);
            }

            if (c.indexOf(name) == 0) 
            {
                return c.substring(name.length, c.length);
            }
        }

        return "";
    },

    deleteCookie: function (cname) 
    {
        const d = new Date();

        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires=Thu, 01 Jan 1970 00:00:00 UTC";

        document.cookie = cname + "=delete;" + expires + ";path=/";
    }
};
/*
 * End File:
 * ./framework/util/cookie.js
 */ 

/*
 * Start File:
 * ./framework/util/ease.js
 */ 
//ease functions

var ease = {

	//
	// Basic ease functions
	//

	easeConstant: function (time, begin, change, duration)
	{
		"use strict";
		return begin;
	},

	easeLinear: function (time, begin, change, duration)
	{
		"use strict";
		var val = time / duration;
		return begin + change * val;
	},

	easeInPower: function (time, begin, change, duration, power)
	{
		"use strict";
		var val;
		if (power === undefined) { power = 3; }
		val = Math.pow(time / duration, power);
		return begin + change * val;
	},

	easeOutPower: function (time, begin, change, duration, power)
	{
		"use strict";
		var val = tbEase.easeInPower(duration - time, 1, -1, duration, power);
		return begin + change * val;
	},

	easeInOutPower: function (time, begin, change, duration, power)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInPower(time, 0, 0.5, duration / 2, power);
		} else
		{
			val = tbEase.easeInPower(duration - time, 1, -0.5, duration / 2, power);
		}
		return begin + change * val;
	},

	easeOutInPower: function (time, begin, change, duration, power)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInPower(duration / 2 - time, 0.5, -0.5, duration / 2, power);
		} else
		{
			val = tbEase.easeInPower(time - duration / 2, 0.5, 0.5, duration / 2, power);
		}
		return begin + change * val;
	},

	easeInQuadratic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInPower(time, begin, change, duration, 2);
	},

	easeOutQuadratic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutPower(time, begin, change, duration, 2);
	},

	easeInOutQuadratic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInOutPower(time, begin, change, duration, 2);
	},

	easeOutInQuadratic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutInPower(time, begin, change, duration, 2);
	},

	easeInCubic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInPower(time, begin, change, duration, 3);
	},

	easeOutCubic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutPower(time, begin, change, duration, 3);
	},

	easeInOutCubic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInOutPower(time, begin, change, duration, 3);
	},

	easeOutInCubic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutInPower(time, begin, change, duration, 3);
	},

	easeInQuartic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInPower(time, begin, change, duration, 4);
	},

	easeOutQuartic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutPower(time, begin, change, duration, 4);
	},

	easeInOutQuartic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInOutPower(time, begin, change, duration, 4);
	},

	easeOutInQuartic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutInPower(time, begin, change, duration, 4);
	},

	easeInQuintic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInPower(time, begin, change, duration, 5);
	},

	easeOutQuintic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutPower(time, begin, change, duration, 5);
	},

	easeInOutQuintic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeInOutPower(time, begin, change, duration, 5);
	},

	easeOutInQuintic: function (time, begin, change, duration)
	{
		"use strict";
		return tbEase.easeOutInPower(time, begin, change, duration, 5);
	},

	easeInExponential: function (time, begin, change, duration, power)
	{
		"use strict";
		var val, base;
		if (power === undefined) { power = 8; }
		base = Math.pow(2, -power);			// The exponential function will not cover the whole range from 0-1 so we must correct it
		val = (Math.pow(2, power * time / duration - power) - base) / (1 - base);
		return begin + change * val;
	},

	easeOutExponential: function (time, begin, change, duration, power)
	{
		"use strict";
		var val = tbEase.easeInExponential(duration - time, 1, -1, duration, power);
		return begin + change * val;
	},

	easeInOutExponential: function (time, begin, change, duration, power)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInExponential(time, 0, 0.5, duration / 2, power);
		} else
		{
			val = tbEase.easeInExponential(duration - time, 1, -0.5, duration / 2, power);
		}
		return begin + change * val;
	},

	easeOutInExponential: function (time, begin, change, duration, power)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInExponential(duration / 2 - time, 0.5, -0.5, duration / 2, power);
		} else
		{
			val = tbEase.easeInExponential(time - duration / 2, 0.5, 0.5, duration / 2, power);
		}
		return begin + change * val;
	},

	easeInSine: function (time, begin, change, duration)
	{
		"use strict";
		var val = 1 - Math.cos(time / duration * Math.PI / 2);
		return begin + change * val;
	},

	easeOutSine: function (time, begin, change, duration)
	{
		"use strict";
		var val = tbEase.easeInSine(duration - time, 1, -1, duration);
		return begin + change * val;
	},

	easeInOutSine: function (time, begin, change, duration)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInSine(time, 0, 0.5, duration / 2);
		} else
		{
			val = tbEase.easeInSine(duration - time, 1, -0.5, duration / 2);
		}
		return begin + change * val;
	},

	easeOutInSine: function (time, begin, change, duration)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInSine(duration / 2 - time, 0.5, -0.5, duration / 2);
		} else
		{
			val = tbEase.easeInSine(time - duration / 2, 0.5, 0.5, duration / 2);
		}
		return begin + change * val;
	},

	easeInCircular: function (time, begin, change, duration)
	{
		"use strict";
		var val = 1 - Math.sqrt(1 - Math.pow(time / duration, 2));
		return begin + change * val;
	},

	easeOutCircular: function (time, begin, change, duration)
	{
		"use strict";
		var val = tbEase.easeInCircular(duration - time, 1, -1, duration);
		return begin + change * val;
	},

	easeInOutCircular: function (time, begin, change, duration)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInCircular(time, 0, 0.5, duration / 2);
		} else
		{
			val = tbEase.easeInCircular(duration - time, 1, -0.5, duration / 2);
		}
		return begin + change * val;
	},

	easeOutInCircular: function (time, begin, change, duration)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInCircular(duration / 2 - time, 0.5, -0.5, duration / 2);
		} else
		{
			val = tbEase.easeInCircular(time - duration / 2, 0.5, 0.5, duration / 2);
		}
		return begin + change * val;
	},

	easeInElastic: function (time, begin, change, duration, oscillations, stiffness)
	{
		"use strict";
		var val;
		if (oscillations === undefined) { oscillations = 3; }
		if (stiffness === undefined) { stiffness = 8; }
		val = Math.sin((1 - time / duration) * 2 * Math.PI * oscillations + Math.PI / 2);			// Create the correct sign
		val *= tbEase.easeInExponential(time, 0, 1, duration, stiffness);				// Multiply with an exponential ease in
		return begin + change * val;
	},

	easeOutElastic: function (time, begin, change, duration, oscillations, stiffness)
	{
		"use strict";
		var val = tbEase.easeInElastic(duration - time, 1, -1, duration, oscillations, stiffness);
		return begin + change * val;
	},

	easeInOutElastic: function (time, begin, change, duration, oscillations, stiffness)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInElastic(time, 0, 0.5, duration / 2, oscillations, stiffness);
		} else
		{
			val = tbEase.easeInElastic(duration - time, 1, -0.5, duration / 2, oscillations, stiffness);
		}
		return begin + change * val;
	},

	easeOutInElastic: function (time, begin, change, duration, oscillations, stiffness)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInElastic(duration / 2 - time, 0.5, -0.5, duration / 2, oscillations, stiffness);
		} else
		{
			val = tbEase.easeInElastic(time - duration / 2, 0.5, 0.5, duration / 2, oscillations, stiffness);
		}
		return begin + change * val;
	},

	easeInOvershoot: function (time, begin, change, duration, overshoot)
	{
		"use strict";
		var val;
		if (overshoot === undefined) { overshoot = 1.70158; }
		val = (1 + overshoot) * Math.pow(time / duration, 3) - overshoot * Math.pow(time / duration, 2);
		return begin + change * val;

	},

	easeOutOvershoot: function (time, begin, change, duration, overshoot)
	{
		"use strict";
		var val = tbEase.easeInOvershoot(duration - time, 1, -1, duration, overshoot);
		return begin + change * val;
	},

	easeInOutOvershoot: function (time, begin, change, duration, overshoot)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInOvershoot(time, 0, 0.5, duration / 2, overshoot);
		} else
		{
			val = tbEase.easeInOvershoot(duration - time, 1, -0.5, duration / 2, overshoot);
		}
		return begin + change * val;
	},

	easeOutInOvershoot: function (time, begin, change, duration, overshoot)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInOvershoot(duration / 2 - time, 0.5, -0.5, duration / 2, overshoot);
		} else
		{
			val = tbEase.easeInOvershoot(time - duration / 2, 0.5, 0.5, duration / 2, overshoot);
		}
		return begin + change * val;
	},

	easeInBounce: function (time, begin, change, duration, number, factor)
	{
		"use strict";
		var bounces, i, w, width, height, val;
		// Correct the arguments
		if (number === undefined) { number = 4; }
		if (factor === undefined) { factor = 2; } else { factor = Math.sqrt(factor); }
		// Create the list of bounces
		bounces = [1];
		width = 1;
		for (i = 1; i < number; i += 1)
		{
			bounces.push(bounces[i - 1] * factor);
			width += bounces[i];
		}
		// Compute total size
		width -= bounces[number - 1] / 2;		// We don't use the last half bounce
		height = Math.pow(bounces[number - 1], 2);
		time = time / duration * width;
		// Find the correct bounce
		w = 0;
		for (i = 0; i < number; i += 1)
		{
			if (time > bounces[i]) { time -= bounces[i]; } else { w = bounces[i]; break; }
		}
		// Now compute the value
		val = -4 * Math.pow(time - w / 2, 2) + w * w;
		return begin + change * val / height;
	},

	easeOutBounce: function (time, begin, change, duration, number, factor)
	{
		"use strict";
		var val = tbEase.easeInBounce(duration - time, 1, -1, duration, number, factor);
		return begin + change * val;
	},

	easeInOutBounce: function (time, begin, change, duration, number, factor)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInBounce(time, 0, 0.5, duration / 2, number, factor);
		} else
		{
			val = tbEase.easeInBounce(duration - time, 1, -0.5, duration / 2, number, factor);
		}
		return begin + change * val;
	},

	easeOutInBounce: function (time, begin, change, duration, number, factor)
	{
		"use strict";
		var val;
		if (time < duration / 2)
		{
			val = tbEase.easeInBounce(duration / 2 - time, 0.5, -0.5, duration / 2, number, factor);
		} else
		{
			val = tbEase.easeInBounce(time - duration / 2, 0.5, 0.5, duration / 2, number, factor);
		}
		return begin + change * val;
	}
};
/*
 * End File:
 * ./framework/util/ease.js
 */ 

/*
 * Start File:
 * ./framework/util/input.js
 */ 


var GameInput =
{
	keys: {},
	g_keyStatus: [],
	g_pKeyStatus: [],

	g_pressKeyStatus: [],
	g_ppressKeyStatus: [],

	g_pressBlacklist: [],

	g_mouseDown: false,
	g_mouseDownThisFrame: false,

	g_altMouseDown: false,
	g_altMouseDownThisFrame: false,

	g_middleMouseDown: false,
	g_middleMouseDownThisFrame: false,

	trueMousePosition: null,
	mousePosition: null,

	MouseButtons: {
		Left: 0,
		Middle: 1,
		Right: 2
	},

	g_init: function ()
	{
		trueMousePosition = new vector(0, 0);
		mousePosition = new vector(0, 0);

		document.onkeydown = GameInput.g_setKeyStatus;
		document.onkeyup = GameInput.g_setKeyStatus;

		document.oncontextmenu = function () { return false; };

		document.onmousedown = function (e)
		{
			switch (e.button)
			{
				case GameInput.MouseButtons.Left: GameInput.g_mouseDownThisFrame = true; break;
				case GameInput.MouseButtons.Middle: GameInput.g_middleMouseDownThisFrame = true; break;
				case GameInput.MouseButtons.Right: GameInput.g_altMouseDownThisFrame = true; break;
			}
		};

		document.onmouseup = function (e)
		{
			switch (e.button)
			{
				case GameInput.MouseButtons.Left:
					GameInput.g_mouseDownThisFrame = false;
					GameInput.g_mouseDown = false;
					break;
				case GameInput.MouseButtons.Middle:
					GameInput.g_middleMouseDownThisFrame = false;
					GameInput.g_middleMouseDown = false;
					break;
				case GameInput.MouseButtons.Right:
					GameInput.g_altMouseDownThisFrame = false;
					GameInput.g_altMouseDown = false;
					break;
			}
		};

		document.onmousemove = function (e)
		{
			if (!GameInput.trueMousePosition)
				GameInput.trueMousePosition = new vector();

			GameInput.trueMousePosition.x = e.x;
			GameInput.trueMousePosition.y = e.y;
		};

		var el = document.getElementsByTagName("body")[0];
		el.addEventListener("touchstart", function () { GameInput.g_mouseDownThisFrame = true; }, false);
		el.addEventListener("touchend", function () { GameInput.g_mouseDownThisFrame = false; GameInput.g_mouseDown = false; }, false);
		el.addEventListener("touchcancel", function () { GameInput.g_mouseDownThisFrame = false; GameInput.g_mouseDown = false; }, false);
		el.addEventListener("touchmove", function () { return false; }, false);
	},

	g_setKeyStatus: function (e)
	{
		GameInput.keys[e.key] = e.which;
		GameInput.g_keyStatus[e.which] = (e.type == "keydown");

		if (!GameInput.g_pressBlacklist[e.which])
			GameInput.g_pressKeyStatus[e.which] = (e.type == "keydown");

		GameInput.g_pressBlacklist[e.which] = (e.type == "keydown"); //only allow single presses if key has been released once
	},

	g_updateKeys: function ()
	{
		GameInput.mousePosition = GameInput.trueMousePosition;

		GameInput.g_pKeyStatus = GameInput.g_keyStatus;
		GameInput.g_ppressKeyStatus = GameInput.g_pressKeyStatus;
		GameInput.g_pressKeyStatus = [];

		if (GameInput.g_mouseDown && GameInput.g_mouseDownThisFrame)
		{
			GameInput.g_mouseDownThisFrame = false;
		}

		if (GameInput.g_mouseDownThisFrame && !GameInput.g_mouseDown)
		{
			GameInput.g_mouseDown = true;
		}

		if (GameInput.g_altMouseDown && GameInput.g_altMouseDownThisFrame)
		{
			GameInput.g_altMouseDownThisFrame = false;
		}

		if (GameInput.g_altMouseDownThisFrame && !GameInput.g_altMouseDown)
		{
			GameInput.g_altMouseDown = true;
		}

		if (GameInput.g_middleMouseDown && GameInput.g_middleMouseDownThisFrame)
		{
			GameInput.g_middleMouseDownThisFrame = false;
		}

		if (GameInput.g_middleMouseDownThisFrame && !GameInput.g_middleMouseDown)
		{
			GameInput.g_middleMouseDown = true;
		}
	},


	isPressed: function (keyCode)
	{
		if (GameInput.g_ppressKeyStatus[keyCode] == null)
			return false;
		else
			return GameInput.g_ppressKeyStatus[keyCode];
	},


	isHeld: function (keyCode)
	{
		if (GameInput.g_pKeyStatus[keyCode] == null)
			return false;
		else
			return GameInput.g_pKeyStatus[keyCode];
	},

	mousePressed: function (btn)
	{
		switch (btn)
		{
			case GameInput.MouseButtons.Left: return GameInput.g_mouseDownThisFrame;
			case GameInput.MouseButtons.Middle: return GameInput.g_middleMouseDownThisFrame;
			case GameInput.MouseButtons.Right: return GameInput.g_altMouseDownThisFrame;
		}

		return { left: GameInput.g_mouseDownThisFrame, middle: GameInput.g_middleMouseDownThisFrame, right: GameInput.g_altMouseDownThisFrame };
	},

	mouseHeld: function (btn)
	{
		switch (btn)
		{
			case GameInput.MouseButtons.Left: return GameInput.g_mouseDown;
			case GameInput.MouseButtons.Middle: return GameInput.g_middleMouseDown;
			case GameInput.MouseButtons.Right: return GameInput.g_altMouseDown;
		}

		return { left: GameInput.g_mouseDown, middle: GameInput.g_middleMouseDown, right: GameInput.g_altMouseDown };
	}
};//
/*
 * End File:
 * ./framework/util/input.js
 */ 

/*
 * Start File:
 * ./framework/util/particleEmitter.js
 */ 
class ParticleEmitter
{
    static pool = [];
    enabled = false;
    mine = [];
    position = null;

    emissionRate = 0;
    emissionTimer = 0;
    emissionAngle = 0;

    startRotation = 0;
    startVelocity = 0;
    startAngularVelocity = 0;
    acceleration = null;
    angularAcceleration = 0;
    sprite = null;
    startSize = null;
    endSize = null;
    lifetimeMin = 0;
    lifetimeMax = 0;
    fadeIn = 0;
    fadeOut = 0;
    animationSpeed = 0;
    startFrame = 0;

    friction = null;
    angularFriction = 0;

    constructor (position, sprite, emissionRate, emissionAngle,
        startRotation, startVelocity, startAngularVelocity, acceleration,
        angularAcceleration, startSize, endSize, lifetimeMin,
        lifetimeMax = -1, fadeIn = 0, fadeOut = 0, startFrame = 0, animationSpeed = 0)
    {
        if (lifetimeMax < 0)
            lifetimeMax = lifetimeMin;

        this.position = position;
        this.sprite = sprite;

        this.emissionRate = emissionRate;
        this.emissionTimer = emissionRate;
        this.emissionAngle = emissionAngle;

        this.startRotation = startRotation;
        this.startVelocity = startVelocity * 10;
        this.startAngularVelocity = startAngularVelocity * 10;
        this.acceleration = acceleration.stretch(10);
        this.angularAcceleration = angularAcceleration * 10;
        this.startSize = startSize;
        this.endSize = endSize;
        this.lifetimeMin = lifetimeMin;
        this.lifetimeMax = lifetimeMax;
        this.fadeIn = fadeIn;
        this.fadeOut = fadeOut;
        this.startFrame = startFrame;
        this.animationSpeed = animationSpeed;

        this.friction = new vector(0, 0);
    }

    start ()
    {
        this.enabled = true;
    }

    stop ()
    {
        this.enabled = false;
    }

    emit (amount = 1)
    {
        for (let i = 0; i < amount; i++)
        {
            let newParticle = ParticleEmitter.unPool();
            this.mine.push(newParticle);

            let velocity = vector.fromAngle(this.emissionAngle).stretch(this.startVelocity);
            newParticle.emit(this, this.position.x, this.position.y, this.startRotation,
                velocity.x, velocity.y, this.startAngularVelocity, this.acceleration.x,
                this.acceleration.y, this.angularAcceleration, this.sprite, this.startSize.x,
                this.startSize.y, this.endSize.x, this.endSize.y, this.lifetimeMin,
                this.lifetimeMax, this.fadeIn, this.fadeOut, this.startFrame, this.animationSpeed,
                this.friction, this.angularFriction);
        }
    }

    update (deltaTime)
    {
        if (this.enabled)
            this.emissionTimer -= deltaTime;

        if (this.emissionTimer <= 0)
        {
            this.emissionTimer = this.emissionRate;
            this.emit();
        }

        for (let i = 0; i < this.mine.length; i++)
        {
            this.mine[i].update(deltaTime);
        }
    }

    draw (scene)
    {
        for (let i = 0; i < this.mine.length; i++)
        {
            this.mine[i].draw(scene);
        }
    }

    dispose (particle)
    {
        this.mine.remove(particle);
        ParticleEmitter.returnToPool(particle);
    }

    static unPool () //get a particle from the static pool
    {
        if (ParticleEmitter.pool.length > 0)
        {
            return ParticleEmitter.pool.pop();
        }

        return new Particle();
    }

    static returnToPool (particle)
    {
        if (!ParticleEmitter.pool.contains(particle))
        {
            ParticleEmitter.pool.push(particle);
        }
    }
}

class Particle
{
    parent = null;
    position = null;
    rotation = 0;
    velocity = null;
    angularVelocity = 0;
    acceleration = null;
    angularAcceleration = 0;
    sprite = null;
    animTimer = 0;
    animationSpeed = 0;
    subImage = 0;
    startSize = null;
    endSize = null;
    fadeInTime = 0;
    fadeInStart = 0;
    fadeOutTime = 0;
    lifeTime = 0;
    lifeTimeStart = 0;
    friction = null;
    angularfriction = 0;

    constructor ()
    {
        this.position = new vector(0, 0);
        this.velocity = new vector(0, 0);
        this.acceleration = new vector(0, 0);
        this.startSize = new vector(0, 0);
        this.endSize = new vector(0, 0);
    }

    emit (parent, x, y, r, vx, vy, va, ax, ay, ar, spr, ssx, ssy, esx, esy, lmin, lmax, fi = 0, fo = 0, sf = 0, as = 0, fric, anfric)
    {
        this.parent = parent;
        this.position.x = x;
        this.position.y = y;
        this.rotation = r;
        this.velocity.x = vx;
        this.velocity.y = vy;
        this.angularVelocity = va;
        this.acceleration.x = ax;
        this.acceleration.y = ay;
        this.angularAcceleration = ar;
        this.sprite = spr;
        this.startSize.x = ssx;
        this.startSize.y = ssy;
        this.endSize.x = esx;
        this.endSize.y = esy;
        this.lifeTime = Math.randomRange(lmin, lmax);
        this.lifeTimeStart = this.lifeTime;
        this.fadeInTime = fi;
        this.fadeInStart = fi;
        this.fadeOutTime = fo;
        this.animationSpeed = as;
        this.animTimer = as;
        this.subImage = sf;
        this.friction = fric;
        this.angularFriction = anfric;
    }

    update (deltaTime)
    {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;

        this.velocity.x += this.friction.x * deltaTime * -Math.sign(this.velocity.x * 10);
        this.velocity.y += this.friction.y * deltaTime * -Math.sign(this.velocity.y * 10);

        this.rotation += this.angularVelocity * deltaTime;
        this.angularVelocity += this.angularAcceleration * deltaTime;

        this.angularVelocity += this.angularFriction * deltaTime * -Math.sign(this.angularVelocity * 10);

        this.lifeTime -= deltaTime;

        if (this.fadeInTime > 0)
            this.fadeInTime -= deltaTime;

        if (this.animationSpeed > 0)
        {
            this.animTimer -= deltaTime;

            if (this.animTimer <= 0)
            {
                this.animTimer = this.animationSpeed;
                this.subImage = this.subImage + 1 % this.sprite.subImages;
            }
        }

        if (this.lifeTime <= 0)
            this.parent.dispose(this);
    }

    draw (scene)
    {
        let foAlpha = Math.min(1, this.lifeTime / this.fadeOutTime);

        let fiAlpha = 1 - (this.fadeInTime / this.fadeInStart);

        this.sprite.draw(
            scene,
            Math.round(this.position.x),
            Math.round(this.position.y),
            Math.lerp(this.endSize.x, this.startSize.x, this.lifeTime / this.lifeTimeStart),
            Math.lerp(this.endSize.y, this.startSize.y, this.lifeTime / this.lifeTimeStart),
            this.rotation,
            false,
            false,
            Math.min(fiAlpha, foAlpha),
            this.subImage
        );
    }
}
/*
 * End File:
 * ./framework/util/particleEmitter.js
 */ 

/*
 * Start File:
 * ./framework/util/ray.js
 */ 
class Ray
{
    static Cast (scene, origin, direction, maxLength = -1)
    {
        direction = direction.normalize();
        let hits = []; // {hitObj, hitPoint}
        for (var i = 0; i < scene.activeObjects.length; i++)
        {
            let castAngle = direction.toAngle();

            if (scene.activeObjects[i] != this && scene.activeObjects[i].collider.enabled)
            {
                var hw = scene.activeObjects[i].transform.size.x / 2;
                var hh = scene.activeObjects[i].transform.size.y / 2;

                let points =
                    [
                        new vector(scene.activeObjects[i].transform.position.x - hw, scene.activeObjects[i].transform.position.y - hh),
                        new vector(scene.activeObjects[i].transform.position.x + hw, scene.activeObjects[i].transform.position.y - hh),
                        new vector(scene.activeObjects[i].transform.position.x - hw, scene.activeObjects[i].transform.position.y + hh),
                        new vector(scene.activeObjects[i].transform.position.x + hw, scene.activeObjects[i].transform.position.y + hh)
                    ];

                points.sort((p1, p2) => p1.subtract(origin).length - p2.subtract(origin).length).pop();

                for (let p = 0; p < points.length; p++)
                {
                    let point = points[p];
                    let deltaDistance = point.subtract(origin).length;

                    if (deltaDistance > maxLength && maxLength > 0)
                    {
                        continue;
                    }

                    let stretched = direction.stretch(Math.min(deltaDistance, maxLength > 0 ? maxLength : deltaDistance));

                    let calcPoint = origin.add(stretched);

                    if (scene.activeObjects[i].collider.isInBounds(calcPoint))
                    {
                        //determine in between which vector angles ray is
                        var angles = points.map(p => Ray.mapPointToPointAndAngle(p, origin));

                        pointLoop:
                        for (let pa = 0; pa < angles.length; pa++) 
                        {
                            for (let pb = 0; pb < angles.length; pb++)
                            {
                                if (angles[pa].angle - angles[pb].angle > 270 || angles[pb].angle - angles[pa].angle > 270)
                                {

                                    castAngle = (castAngle + 180) % 360;
                                    angles.forEach(pIn => pIn.angle = (pIn.angle + 180) % 360);
                                    break pointLoop;
                                }
                            }
                        }

                        angles = angles.sort((a, b) => b.angle - a.angle);

                        if (angles[1].length > angles[0].length && angles[1].length > angles[2].length)
                        {
                            //only one face can be hit at this time, which is between angles[0] and angles[2]
                            angles.removeAt(1); //remove the center, connecting to the un-hittable face
                        }
                        else
                        {
                            //one of two faces can be hit at this time, either angles[0]-angles[1] or angles[1]-angles[2]
                            (castAngle > angles[1].angle) ? angles.pop() : angles.shift(); //figure out on which side we are, and remove the furthest
                        }

                        //calc % of angle in relation to the angles it is between
                        let smallAngle = Math.min(angles[1].angle, angles[0].angle);
                        let percent = (castAngle - smallAngle) / (Math.max(angles[1].angle, angles[0].angle) - smallAngle);

                        hits.push({ hitObj: scene.activeObjects[i], hitPoint: angles[1].point.lerpTo(angles[0].point, percent) });
                        break;
                    }
                }
            }
        }

        let shortest = hits[0];

        for (let i = 0; i < hits.length; i++)
        {
            if (hits[i].length < shortest.length)
            {
                shortest = hits[i];
            }
        }

        return shortest;
    }

    static mapPointToPointAndAngle (point, origin) 
    {
        let delta = point.subtract(origin);

        return {
            point: point,
            angle: delta.toAngle(),
            length: delta.length
        };
    }
}
/*
 * End File:
 * ./framework/util/ray.js
 */ 

/*
 * Start File:
 * ./framework/util/signal.js
 */ 
// Basic event listeners, modeled after Phaser Signals

class Signal
{
    listeners = [];

    dispatch ()
    {
        for (var i = 0; i < this.listeners.length; i++)
        {
            this.listeners[i].callback.call(this.listeners[i].context);
        }

        for (var i = this.listeners.length - 1; i > 0; i--)
        {
            if (this.listeners[i].once)
            {
                this.listeners.splice(i, 1);
            }
        }
    }

    add (callback, context, once)
    {
        if (!this.contains(callback, context))
        {
            this.listeners.push({ callback: callback, context: context, once: once });
        }
    }

    addOnce (callback, context)
    {
        this.add(callback, context, true);
    }

    contains (callback, context)
    {
        for (var i = this.listeners.length - 1; i > 0; i--)
        {
            if (this.listeners[i].callback === callback && this.listeners[i].context === context)
            {
                return true;
            }
        }

        return false;
    }

    remove (callback, context)
    {
        for (var i = this.listeners.length - 1; i > 0; i--)
        {
            if (this.listeners[i].callback === callback && this.listeners[i].context === context)
            {
                this.listeners.splice(i, 1);
                break;
            }
        }
    }

    removeAll ()
    {
        this.listeners = [];
    }
}
/*
 * End File:
 * ./framework/util/signal.js
 */ 

/*
 * Start File:
 * ./framework/util/timingUtil.js
 */ 
/**
 /* Timing utility
 /*/

timingUtil =
{
    delayUntilCondition: function (conditionFunction, conditionContext, callback, context, interval)
    {
        interval = interval || 1;

        if (conditionFunction.call(conditionContext))
        {
            callback.call(context);
        }
        else
        {
            setTimeout(function ()
            {
                TimingUtil.delayUntilCondition(conditionFunction, conditionContext, callback, context, interval);
            }, interval);
        }
    },

    delayUntilNextFrame: function (callback, context)
    {
        Game.queuedCallbacks.push({ callback: callback, context: context });
    },

    delay: function (milliseconds, callback, context)
    {
        return setTimeout(function ()
        {
            callback.call(context);
        }, milliseconds);
    },

    stop: function (timer)
    {
        clearTimeout(timer);
    },

    repeat: function (milliseconds, callback, context)
    {
        return setInterval(function ()
        {
            callback.call(context);
        }, milliseconds);
    }
};
/*
 * End File:
 * ./framework/util/timingUtil.js
 */ 

/*
 * Start File:
 * ./framework/util/urlParams.js
 */ 
var UrlParams =
{
    get: function (key)
    {
        var url_string = window.location.href;
        var url = new URL(url_string);
        var c = url.searchParams.get(key);

        return c;
    },

    set: function (key, value)
    {
        var url_string = window.location.href;
        var url = new URL(url_string);
        url.searchParams.set(key, value);

        window.history.pushState(null, {}, url);
    }
};
/*
 * End File:
 * ./framework/util/urlParams.js
 */ 

/*
 * Start File:
 * ./framework/util/vector.js
 */ 
class vector
{
	x = 0;
	y = 0;

	constructor (x, y)
	{
		this.x = x;

		this.y = y;
	}

	get length ()
	{
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	}

	getLength ()
	{
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	}


	toAngle ()
	{
		let angle = (Math.atan2(this.y, this.x) * 180 / Math.PI) + 90;
		if (angle < 0)
			angle += 360;
		return angle;
	}

	static fromAngle (angle)
	{
		angle = 360 - ((angle + 180) % 360);
		angle = (angle / 180) * Math.PI;
		return new vector(Math.sin(angle), Math.cos(angle));
	}

	normalize ()
	{
		var newVector = this.getCopy();

		if (newVector.length != 0)
		{
			var length = newVector.length;
			newVector.x /= length;
			newVector.y /= length;
		}

		return newVector;
	}


	lerpTo (otherVector, t)
	{
		var delta = otherVector.subtract(this);

		return this.add(delta.stretch(t));
	}


	distanceTo (otherVector)
	{
		var dX = this.x - otherVector.x;
		var dY = this.y - otherVector.y;

		return new vector(dX, dY).length;
	}


	add (otherVector)
	{
		var newVector = this.getCopy();

		newVector.x += otherVector.x;
		newVector.y += otherVector.y;

		return newVector;
	}


	subtract (otherVector)
	{
		var newVector = this.getCopy();

		newVector.x -= otherVector.x;
		newVector.y -= otherVector.y;

		return newVector;
	}


	multiply (otherVector)
	{
		var newVector = this.getCopy();

		newVector.x *= otherVector.x;
		newVector.y *= otherVector.y;

		return newVector;
	}


	divide (otherVector)
	{
		var newVector = this.getCopy();

		newVector.x /= otherVector.x;
		newVector.y /= otherVector.y;

		return newVector;
	}


	stretch (length)
	{
		var newVector = this.getCopy();

		newVector.x *= length;
		newVector.y *= length;

		return newVector;
	}

	rotate (degrees)
	{
		var ca = Math.cos(degrees * (Math.PI / 180));
		var sa = Math.sin(degrees * (Math.PI / 180));
		return new vector(ca * this.x - sa * this.y, sa * this.x + ca * this.y);
	}

	deltaAngle (otherVector)
	{
		var a = this.toAngle() * (Math.PI / 180);
		var b = otherVector.toAngle() * (Math.PI / 180);

		return Math.atan2(Math.sin(a - b), Math.cos(a - b)) * (180 / Math.PI);
	}

	cross (otherVector)
	{
		return this.x * otherVector.y - this.y * otherVector.x;
	}


	getCopy ()
	{
		return new vector(this.x, this.y);
	}
};
/*
 * End File:
 * ./framework/util/vector.js
 */ 
