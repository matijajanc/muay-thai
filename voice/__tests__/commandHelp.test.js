import { COMMAND_HELP } from '../commandHelp';
import { parseCommands } from '../parseCommands';

// The help list must only teach phrases the grammar understands.
const phrases = COMMAND_HELP.flatMap(section =>
  section.commands.flatMap(c => c.say.map(say => [section.title, say])));

describe('voice command help', () => {
  it.each(phrases)('%s: “%s” parses to exactly one command', (_, say) => {
    expect(parseCommands(say)).toHaveLength(1);
  });
});
