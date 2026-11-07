#include "WindowsGamepad.h"
#if defined(_WIN32)
#include "XInputMapping.h"
#include "cocos/engine/EngineEvents.h"
#include <chrono>
#include <memory>

namespace {
class WindowsPads {
public:
    WindowsPads() {
        // System-only lookup avoids loading a DLL from the game/current directory.
        for (const auto name : {L"xinput1_4.dll", L"xinput9_1_0.dll", L"xinput1_3.dll"}) {
            library = LoadLibraryExW(name, nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
            if (library) {
                read = reinterpret_cast<Reader>(GetProcAddress(library, "XInputGetState"));
                if (read) break;
                FreeLibrary(library); library = nullptr;
            }
        }
    }
    ~WindowsPads() { if (library) FreeLibrary(library); }
    void poll() {
        if (!read) return;
        DWORD foregroundProcess = 0;
        GetWindowThreadProcessId(GetForegroundWindow(), &foregroundProcess);
        const bool focused = foregroundProcess == GetCurrentProcessId();
        const auto now = std::chrono::steady_clock::now();
        cc::ControllerEvent event;
        event.type = cc::ControllerEvent::Type::GAMEPAD;
        cc::ControllerChangeEvent change;
        for (DWORD i = 0; i < XUSER_MAX_COUNT; ++i) {
            // Missing devices are probed at a low rate, active ones once per frame.
            if (!focused) { sent[i] = false; continue; }
            if (!connected[i] && now < nextProbe[i]) continue;
            XINPUT_STATE state{};
            connected[i] = read(i, &state) == ERROR_SUCCESS;
            if (!connected[i]) {
                sent[i] = false;
                nextProbe[i] = now + std::chrono::milliseconds(750);
                continue;
            }
            change.controllerIds.push_back(i);
            // Held input is retained by the engine device; unchanged packets need no JS allocation.
            if (sent[i] && packet[i] == state.dwPacketNumber) continue;
            sent[i] = true; packet[i] = state.dwPacketNumber;
            const auto values = monarch::mapXInput(state.Gamepad);
            auto info = std::make_unique<cc::ControllerInfo>();
            info->napdId = int(i);
            for (const auto &button : values.buttons)
                info->buttonInfos.emplace_back(static_cast<cc::StickKeyCode>(button.first), button.second);
            for (const auto &axis : values.axes)
                info->axisInfos.emplace_back(static_cast<cc::StickAxisCode>(axis.first), axis.second);
            event.controllerInfos.push_back(std::move(info));
        }
        // Blur looks like a disconnect: controls release held input and pause safely.
        if (change.controllerIds != previous) {
            cc::events::ControllerChange::broadcast(change);
            previous = change.controllerIds;
        }
        if (!event.controllerInfos.empty()) cc::events::Controller::broadcast(event);
    }
private:
    using Reader = DWORD(WINAPI *)(DWORD, XINPUT_STATE *);
    HMODULE library = nullptr;
    Reader read = nullptr;
    std::array<bool, XUSER_MAX_COUNT> connected{};
    std::array<bool, XUSER_MAX_COUNT> sent{};
    std::array<DWORD, XUSER_MAX_COUNT> packet{};
    std::array<std::chrono::steady_clock::time_point, XUSER_MAX_COUNT> nextProbe{};
    ccstd::vector<uint32_t> previous;
};
}
void pollWindowsGamepad() { static WindowsPads pads; pads.poll(); }
#endif
