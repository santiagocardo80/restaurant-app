const passport = require('passport')
const crypto = require('crypto')
const User = require('../models/User')
const promisify = require('es6-promisify')
const mail = require('../handlers/mail')

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed Login!',
  successRedirect: '/',
  successFlash: 'You are now logged in!'
})

exports.logout = (req, res) => {
  req.logout()
  req.flash('success', 'You are now logged out!')
  res.redirect('/')
}

exports.isLoggedIn = (req, res, next) => {
  // first check if the user is authenticated
  if (req.isAuthenticated()) {
    next() // carry on!
    return
  }

  req.flash('error', 'Oops! You must be logged in to do that!')
  res.redirect('/login')
}

exports.forgot = async (req, res) => {
  const { email } = req.body
  const user = await User.findOne({ email })

  if (!user) {
    req.flash('error', 'No account with that email exists.')
    return res.redirect('/login')
  }

  user.resetPasswordToken = crypto.randomBytes(20).toString('hex')
  user.resetPasswordExpires = Date.now() + 3600000 // 1 h our from now
  await user.save()

  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`

  await mail.send({
    user,
    subject: 'Password Reset',
    resetURL,
    filename: 'password-reset',
  })

  req.flash('success', `You have been emailed a password reset link.`)
  res.redirect('/login')
}

exports.reset = async (req, res) => {
  const { token } = req.params 
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  })

  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired')
    return res.redirect('/login')
  }

  res.render('reset', { title: 'Reset your Password' })
}

exports.confirmedPasswords = (req, res) => {
  if (req.body.password === req.body['password-confirm']) {
    next()
    return
  }

  req.flash('error', 'Passwords do not match!')
  res.redirect('back')
}

exports.confirmedPasswords = async (req, res) => {
  const { token } = req.params 
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  })

  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired')
    return res.redirect('/login')
  }

  const setPassword = promisify(user.setPassword, user)
  const { password } = req.body
  await setPassword(password)
  user.resetPasswordToken = undefined
  user.resetPasswordExpires = undefined
  const updatedUser = await user.save()
  
  await req.login(updatedUser)
  req.flash('success', 'Nice! Your password has been reset! You are now logged in!')

  res.redirect('/')
}
