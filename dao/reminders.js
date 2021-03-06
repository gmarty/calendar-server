const debug = require('debug')('calendar-server:reminders');

const database = require('./database');
const { InvalidInputError, NotFoundError } = require('../utils/errors');
const {
  checkPropertyType, checkIsArray
} = require('../utils/object_validator.js');

function notFoundError(id) {
  return NotFoundError.createWithSubject('reminder', { name: 'id', value: id });
}

function serializeRecipients(recipients) {
  return JSON.stringify(recipients);
}

function deserializeRecipients(recipients) {
  return JSON.parse(recipients);
}

function deserialize(reminder) {
  reminder.recipients = deserializeRecipients(reminder.recipients);
  return reminder;
}

module.exports = {
  indexByStart(family, start, limit) {
    if (typeof start !== 'number') {
      throw new InvalidInputError('invalid_type', '"start" should be a number');
    }

    if (typeof limit !== 'number') {
      throw new InvalidInputError('invalid_type', '"limit" should be a number');
    }

    debug('indexByStart(family=%s, start=%s, limit=%s)', family, start, limit);

    let statement = 'SELECT * FROM reminders WHERE family = ? AND due >= ?';
    const statementArgs = [ family, start ];
    if (limit) { // if limit is 0, it means no limit
      statement += ' LIMIT ?';
      statementArgs.push(limit);
    }
    debug('statement is `%s`', statement);
    return database.ready
      .then(db => db.all(statement, ...statementArgs))
      .then(reminders => reminders.map(deserialize));
  },

  indexByStatus(family, status, limit) {
    if (typeof limit !== 'number') {
      throw new InvalidInputError('invalid_type', '"limit" should be a number');
    }

    debug('indexByStatus(family=%s, status=%s)', family, status);

    let statement = 'SELECT * FROM reminders WHERE family = ? AND status = ?';
    const statementArgs = [ family, status ];
    if (limit) {
      statement += ' LIMIT ?';
      statementArgs.push(limit);
    }

    return database.ready
      .then(db => db.all(statement, ...statementArgs))
      .then(reminders => reminders.map(deserialize));
  },

  create(family, reminder) {
    debug('create(family=%s, reminder=%o)', family, reminder);

    checkIsArray(reminder, 'recipients', 1);
    checkPropertyType(reminder, 'action', 'string');
    checkPropertyType(reminder, 'due', 'number');

    return database.ready
      .then(db => db.run(
        `INSERT INTO reminders
          (recipients, action, created, due, family)
          VALUES (?, ?, ?, ?, ?)`,
          serializeRecipients(reminder.recipients),
          reminder.action,
          Date.now(),
          reminder.due,
          family
      ))
      .then(result => result.lastId);
  },

  show(family, id) {
    debug('show(family=%s, id=%s)', family, id);

    return database.ready
      .then(db => db.get(
        'SELECT * FROM reminders WHERE family = ? AND id = ?',
        family, id
      ))
      .then(reminder => (
        reminder
          ? deserialize(reminder)
          : Promise.reject(notFoundError(id))
      ));
  },

  delete(family, id) {
    debug('delete(family=%s, id=%s)', family, id);
    return database.ready
      .then(db => db.delete(
        'FROM reminders WHERE family = ? AND id = ?',
        family, id
      ));
  },

  update(family, id, updatedReminder) {
    debug('update(family=%s, id=%s)', family, id);

    checkIsArray(updatedReminder, 'recipients', 1);
    checkPropertyType(updatedReminder, 'action', 'string');
    checkPropertyType(updatedReminder, 'due', 'number');

    return database.ready
      .then(db => db.update(
        `reminders SET
        recipients = ?,
        action = ?,
        due = ?
        WHERE family = ? AND id = ?`,
        serializeRecipients(updatedReminder.recipients),
        updatedReminder.action,
        updatedReminder.due,
        family, id
      ));
  },

  findAllDueReminders(now) {
    debug('findAllDueReminders(now=%d)', now);
    return database.ready.then(db =>
      db.all(
        'SELECT * FROM reminders WHERE due <= ? AND status = "waiting"',
        now
      )
    ).then(reminders => reminders.map(deserialize));
  },

  setReminderStatus(id, status) {
    debug('setReminderStatus(id=%d, status=%s)', id, status);
    return database.ready.then(db =>
      db.update(
        'reminders SET status = ? WHERE id = ?',
        status, id
      )
    );
  },

  // This method doesn't return an error if the status was in error before.
  setReminderStatusIfNotError(id, status) {
    debug('setReminderStatusIfNotError(id=%d, status=%s)', id, status);
    return database.ready.then(db =>
      db.update(
        'reminders SET status = ? WHERE id = ? AND status != "error"',
        status, id
      )
    );
  }
};
