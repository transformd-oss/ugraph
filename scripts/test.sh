#!/usr/bin/env bash

export NODE_ENV=development
export NODE_OPTIONS=--experimental-vm-modules

jest $@
