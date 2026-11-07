/****************************************************************************
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You
 shall not use Cocos Creator software for developing other software or tools
 that's used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to
 you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
#include "Game.h"
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
#include <windows.h>
#include <string>
#include "WindowsGamepad.h"
#endif

#ifndef GAME_NAME
#define GAME_NAME "CocosGame";
#endif

#ifndef SCRIPT_XXTEAKEY
#define SCRIPT_XXTEAKEY "";
#endif

Game::Game() = default;

int Game::init() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
  // 只向本进程注册随包字体。使用宽字符路径，支持安装到中文目录，不修改系统字体设置。
  wchar_t modulePath[32768] = {};
  if (GetModuleFileNameW(nullptr, modulePath, 32768)) {
    std::wstring fontPath(modulePath);
    fontPath = fontPath.substr(0, fontPath.find_last_of(L"\\/")) + L"\\Fonts\\GoblinHand.ttf";
    AddFontResourceExW(fontPath.c_str(), FR_PRIVATE, nullptr);
  }
#endif
  _windowInfo.title = "Goblin: Vile Monarch";
  // PC 默认采用 16:9 客户区，避免继承移动预览的 4:3 窗口。
  _windowInfo.height = 720;
  _windowInfo.width = 1280;

#if CC_DEBUG
  _debuggerInfo.enabled = true;
#else
  _debuggerInfo.enabled = false;
#endif
  _debuggerInfo.port = 6086;
  _debuggerInfo.address = "0.0.0.0";
  _debuggerInfo.pauseOnStart = false;

  _xxteaKey = SCRIPT_XXTEAKEY;

  BaseGame::init();
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
  _padTick.bind([]() { pollWindowsGamepad(); });
#endif
  return 0;
}

void Game::onPause() { BaseGame::onPause(); }

void Game::onResume() { BaseGame::onResume(); }

void Game::onClose() { BaseGame::onClose(); }

CC_REGISTER_APPLICATION(Game);
