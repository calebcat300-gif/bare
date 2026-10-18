cmake_minimum_required(VERSION 3.20)
project(bear LANGUAGES C CXX)

add_library(bear STATIC
    src/runtime/engine.cpp
)

target_compile_features(bear PUBLIC cxx_std_20)
target_include_directories(bear PUBLIC include)
