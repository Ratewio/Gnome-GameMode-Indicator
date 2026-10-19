/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const DBUS_NAME = 'com.feralinteractive.GameMode';
const DBUS_PATH = '/com/feralinteractive/GameMode';

const GameModeIndicator = GObject.registerClass(
    class GameModeIndicator extends QuickSettings.SystemIndicator {
        _proxy;
        _signalId;

        constructor(extensionPath) {
            super();

            this._setup(extensionPath);
        }

        _setup(extensionPath){
            this._icon = this._addIndicator();
            this._icon.gicon = new Gio.FileIcon({
                file: Gio.File.new_for_path(
                    `${extensionPath}/icons/gamepad-symbolic.svg`
                )
            });

            const cancellable = new Gio.Cancellable();

            Gio.DBusProxy.new_for_bus(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.DO_NOT_AUTO_START,
                null,
                DBUS_NAME,
                DBUS_PATH,
                DBUS_NAME,
                cancellable,
                (source, result) => {
                    this._proxy = Gio.DBusProxy.new_for_bus_finish(result);

                    this._signalId = this._proxy.connect(
                        'g-properties-changed',
                        (proxy, changed) => {
                            if (changed.lookup_value('ClientCount', null) !== null)
                                this._sync();
                        }
                    );

                    this._sync()
                }
            );

            this.connect('destroy', () => {
                cancellable.cancel();

                if (this._proxy)
                    this._proxy.disconnect(this._signalId);

                this._proxy = null;
            });
        }

        _sync() {
            const count =
                this._proxy?.get_cached_property('ClientCount')?.deep_unpack()
                ?? 0;

            this._icon.visible = count !== 0;
        }
    });

export default class GameModeExtension extends Extension {
    _indicator;

    enable() {
        this._indicator = new GameModeIndicator(this.path);

        Main.panel.statusArea.quickSettings
            .addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}