console.log("Game started!");
var game = new Game();
game.chaoImages = [];

window.onload = function ()
{

    game.preloadImagesThenStart(
        [
            { name: "frog_basic", url: "images/character/frog/frog_basic.png", subImgTotal: 4, perRow: 4 },
            { name: "frog_tongue_base", url: "images/character/frog/frog_tongue_base.png" },
            { name: "frog_tongue_tip", url: "images/character/frog/frog_tongue_tip.png" },
            { name: "tile_floor_brown", url: "images/tile/tile_floor_brown.png" },
            { name: "tile_floor_explosion", url: "images/tile/tile_floor_explosion_anim.png", subImgTotal: 10, perRow: 5 },
            { name: "fruit", url: "images/object/fruit.png", subImgTotal: 15, perRow: 8 },
            { name: "spacebar", url: "images/spacebar.png" }
        ]
        , function ()
        {
            game.images.frog_basic.addAnimationCycle("walk", [0, 1, 2, 1], true);
            game.images.tile_floor_explosion.addAnimationCycle("destroy", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], false);

            this.createMainScene(game);
        });
};

createMainScene = function (game)
{
    var scene = new FrogScene(200, 200, 416, 320, Scene.DisplayModes.absolute);

    game.loadScene(scene);

};
