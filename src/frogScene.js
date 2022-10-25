class FrogScene extends Scene
{

    fruitSpawnRateMin = 1;
    fruitSpawnRateMax = 2;
    fruitSpawnTimer = 0;

    fruitsMax = 5;

    fruitSpawnChance = .2;

    fruits = [];
    fruitPool = [];
    eatenFruit = [];

    gameSpeed = 1;

    start = false;

    posScaleY = 0;
    text_1_target_y;
    text_2_target_y;

    image_1_target_y;
    image_1_rotation = -1;

    spaceBarTween = null;
    screenTween = null;

    constructor (x, y, width, height, displayMode = 0)
    {
        super(x, y, width, height, displayMode);

        this.renderBackground = false;

        this.fruitSpawnTimer = this.fruitSpawnRateMax;

        this.text_1_target_y = this.real_size.y * .3;
        this.text_2_target_y = this.real_size.y * .62;
        this.image_1_target_y = this.real_size.y * .45;

        this.doMenuScreenTween();

        this.doSpaceBarTweenIn();
    }

    update (deltaTime)
    {
        super.update(deltaTime);

        if (this.start)
        {
            this.spawnFruits(deltaTime);
        }
        else
        {
            this.checkSpacebar();
        }
    }

    reset ()
    {
        if (this.spaceBarTween)
        {
            this.spaceBarTween.stop();
            TWEEN.removeAll();
            this.spaceBarTween = null;
        }

        this.start = false;
        this.activeObjects.forEach(ao => ao.destroy());

        this.posScaleY = 0;

        this.image_1_rotation = -1;
        this.fruitSpawnRateMin = 1;
        this.fruitSpawnRateMax = 2;
        this.fruitSpawnTimer = 0;
        this.gameSpeed = 1;

        this.fruitsMax = 5;

        this.fruits = [];
        this.fruitPool = [];
        this.eatenFruit = [];

        this.doMenuScreenTween();

        this.doSpaceBarTweenIn();
    }

    startGame ()
    {
        if (this.spaceBarTween)
        {
            this.spaceBarTween.stop();
            TWEEN.removeAll();
        }

        this.doAwayMenuScreenTween();

        let frog = new Frog(60, this.real_size.y - 50, this.game.images.frog_basic, 0);

        let tileWidth = this.game.images.tile_floor_brown.width - 2;
        let tileWidthHalf = tileWidth / 2;

        for (let tx = tileWidthHalf - 4; tx < this.real_size.x; tx += tileWidth) 
        {
            this.addObject(new FloorTile(tx, this.real_size.y - 30, this.game.images.tile_floor_brown, 0));
        }
        this.addObject(frog);

        this.start = true;

    }

    increaseDifficulty ()
    {
        this.gameSpeed += .05;

        if (this.fruitSpawnRateMax > .1)
        {
            this.fruitSpawnRateMax -= .2;
        }
        else if (this.fruitSpawnRateMax == .2)
        {
            this.fruitSpawnRateMax = .1;
        }
        if (this.fruitSpawnRateMin > 0)
        {
            this.fruitSpawnRateMin -= .2;
        }

        if (this.fruitsMax < 20 && this.eatenFruit.length % 5 == 0)
        {
            this.fruitsMax++;
        }
    }


    spawnFruits (deltaTime)
    {
        this.fruitSpawnTimer -= deltaTime;
        if (this.fruitSpawnTimer < this.fruitSpawnRateMin) 
        {
            if (this.shouldSpawn())
            {
                let fruit = this.getFromFruitPoolOrCreate();
                fruit.active = true;
                fruit.collider.enabled = true;
                fruit.updateSpeed(Math.randomRange(10, 20) * this.gameSpeed);
                fruit.transform.position = this.getRandomVectorPosition();
                this.setRandomSubImage(fruit);
                this.fruits.push(fruit);

                this.fruitSpawnTimer = this.fruitSpawnRateMax;
            }
        }
    }

    consumeFruit (fruit)
    {
        let currFruit = { scaleX: .5, scaleY: .5, image: fruit.renderer.subImage };
        this.eatenFruit.push(currFruit);

        this.destroyFruit(fruit);

        this.increaseDifficulty();
    }

    destroyFruit (fruit)
    {
        if (this.fruits.contains(fruit))
        {
            fruit.active = false;
            this.fruits.remove(fruit);
            this.fruitPool.push(fruit);
            fruit.transform.position.x = 50000;
        }
    }

    getFromFruitPoolOrCreate ()
    {
        return this.fruitPool.length > 0 ? this.fruitPool.pop() : this.addObject(new Fruit(0, 0, this.game.images.fruit, 0));
    }

    setRandomSubImage (fruit)
    {
        fruit.renderer.subImage = Math.floor(Math.randomRange(0, fruit.renderer.sprite.subImages));
    }

    getRandomVectorPosition ()
    {
        return new vector
            (
                Math.floor(Math.randomRange(0, this.real_size.x)),
                0
            );
    }

    shouldSpawn ()
    {
        return this.fruits.length < this.fruitsMax && (Math.random() < this.fruitSpawnChance || this.fruitSpawnTimer < 0);
    }

    checkSpacebar ()
    {
        if (GameInput.isHeld(GameInput.keys[" "]))
        {
            this.startGame();
        }
    }

    draw ()
    {
        super.draw();

        if (this.posScaleY < 2)
        {
            this.context.font = "20px Monospace";

            let textData = this.context.measureText("Press");
            this.context.fillText("Press", this.real_size.x * .5 - (textData.width / 2), this.text_1_target_y * this.posScaleY, 72);

            textData = this.context.measureText("To Start");
            this.context.fillText("To Lick", this.real_size.x * .5 - (textData.width / 2) + 5, this.text_2_target_y * this.posScaleY, 72);

            let space = this.game.images.spacebar;
            space.draw(this, this.real_size.x * .5, this.image_1_target_y * this.posScaleY, space.width, space.height, this.image_1_rotation * 3, 0, 0, 1, 0);
        }
    }

    doMenuScreenTween ()
    {
        this.screenTween = new TWEEN.Tween(this)
            .to({ posScaleY: 1 }, 800)
            .easing(TWEEN.Easing.Elastic.Out)
            .start();
    }

    doSpaceBarTweenIn ()
    {
        this.spaceBarTween = new TWEEN.Tween(this)
            .to({ image_1_rotation: 1 }, 500)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .yoyo(true)
            .repeat(Infinity)
            .start();
    }


    doAwayMenuScreenTween ()
    {
        this.screenTween
            .to({ posScaleY: 2.5 }, 800)
            .easing(TWEEN.Easing.Elastic.InOut)
            .start();
    }

}