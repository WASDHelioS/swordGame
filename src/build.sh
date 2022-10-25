#!/usr/bin/env bash

BUILD_FILE="./build/game.js"
SRC_DIR="./src"

printf "Build started, output file: $BUILD_FILE\n"

if test -f "$BUILD_FILE"; then
    unlink $BUILD_FILE
fi

loop() 
{
    shopt -s nullglob
    shopt -s globstar

    for file in "$@"/**
    do
        if [ -f "$file" ] && [ "${file##*.}" = "js" ]
        then
            printf "\n/*\n * Start File:\n * "$file"\n */ \n" >> "$BUILD_FILE"; 
            printf "Building "$file"\n";
            cat "$file" >> "$BUILD_FILE"; 
            printf "\n/*\n * End File:\n * "$file"\n */ \n" >> "$BUILD_FILE"; 
        fi
    done
}
loop $SRC_DIR
printf "DONE"