/**
 * Copyright (c) 2006-2019, JGraph Ltd
 * Copyright (c) 2006-2019, draw.io AG
 */
DriveClient = function(editorUi)
{
	mxEventSource.call(this);
	
	DrawioClient.call(this, editorUi, 'gDriveAuthInfo');

	/**
	 * Holds a reference to the UI. Needed for the sharing client.
	 */
	this.ui = editorUi;
	
	// New mime type for XML files
	this.xmlMimeType = 'application/vnd.jgraph.mxfile';
	this.mimeType = 'application/vnd.jgraph.mxfile.realtime';
	
	// Reading files now possible with no initial click in drive
	if (this.ui.editor.chromeless && !this.ui.editor.editable && urlParams['rt'] != '1')
	{
		// Uses separate name for the viewer auth tokens
		this.cookieName = 'gDriveViewerAuthInfo';
		this.token = this.getPersistentToken();
		
		this.appId = window.DRAWIO_GOOGLE_VIEWER_APP_ID || '850530949725';
		this.clientId = window.DRAWIO_GOOGLE_VIEWER_CLIENT_ID || '850530949725.apps.googleusercontent.com';
		this.scopes = ['https://www.googleapis.com/auth/drive.readonly',
			'https://www.googleapis.com/auth/userinfo.profile'];
		this.appIndex = 0;
	}
	else
	{
		this.appId = window.DRAWIO_GOOGLE_APP_ID || '671128082532';
		this.clientId = window.DRAWIO_GOOGLE_CLIENT_ID || '671128082532-jhphbq6d0e1gnsus9mn7vf8a6fjn10mp.apps.googleusercontent.com';
		this.appIndex = 1;
	}
	
	this.mimeTypes = this.xmlMimeType + 'application/mxe,application/mxr,' +
		'application/vnd.jgraph.mxfile.realtime,application/vnd.jgraph.mxfile.rtlegacy';
	
	if (urlParams['photos'] == '1')
	{
		this.scopes.push('https://www.googleapis.com/auth/photos.upload');
	}
	
	var authInfo = JSON.parse(this.token);
	
	if (authInfo != null && authInfo.current != null)
	{
		authInfo = authInfo.current;
		
		this.userId = authInfo.userId;
		this.token = authInfo.access_token;
		
		var remainingTime = (authInfo.expires - Date.now()) / 1000;
		
		authInfo.expires_in = remainingTime < 600? 1 : remainingTime; //10 min tolerance window in case of any rounding errors
		this.resetTokenRefresh(authInfo);

		this.authCalled = false;
	}
};

// Extends mxEventSource
mxUtils.extend(DriveClient, mxEventSource);

// Extends DrawioClient
mxUtils.extend(DriveClient, DrawioClient);

DriveClient.prototype.redirectUri = window.location.protocol + '//' + window.location.host + '/google';
DriveClient.prototype.GDriveBaseUrl = 'https://www.googleapis.com/drive/v2';

/**
 * OAuth 2.0 scopes for installing Drive Apps.
 */
DriveClient.prototype.scopes = ['https://www.googleapis.com/auth/drive.file',
								'https://www.googleapis.com/auth/drive.install',
								'https://www.googleapis.com/auth/userinfo.profile'];

/**
 * Contains the hostname of the old app.
 */
DriveClient.prototype.allFields = 'kind,id,parents,headRevisionId,etag,title,mimeType,modifiedDate,' +
	'editable,copyable,canComment,labels,properties,downloadUrl,webContentLink,userPermission,fileSize';

/**
 * Fields required for catchin up.
 * 
 * TODO: Limit to etag and ekey property only
 */
DriveClient.prototype.catchupFields = 'etag,headRevisionId,modifiedDate,properties(key,value)';

/**
 * Specifies if thumbnails should be enabled. Default is true.
 * LATER: If thumbnails are disabled, make sure to replace the
 * existing thumbnail with the placeholder only once.
 */
DriveClient.prototype.enableThumbnails = true;

/**
 * Specifies the width for thumbnails. Default is 1000. This value
 * must be between 220 and 1600.
 */
DriveClient.prototype.thumbnailWidth = 1000;

/**
 * The maximum number of bytes per thumbnail. Default is 2000000.
 */
DriveClient.prototype.maxThumbnailSize = 2000000;

/**
 * Defines the base64url PNG to be used if no thumbnail was generated
 * (including the case where thumbnails are disabled).
 */
DriveClient.prototype.placeholderThumbnail = 'iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAMAAAAL34HQAAACN1BMVEXwhwXvhgX4iwXzhwXgbQzvhgXhbAzocgzqcwzldAoAAADhbgvjcQnmdgrlbgDwhgXsfwXufgjwhgXwgQfziAXxgADibgz4iwX4jAX3iwTpcwr1igXoewjsfgj3igX4iwXqcQv4jAX3iwXtfQnndQrvhAbibArwhwXgbQz//////v39jwX6jQX+/v7fagHfawzdVQDwhADgbhPgbhXwhwPocQ3uvKvwiA/faQDscgzxiAT97+XgciTgcSP6jAXgbQ3gcCHwiRfpcQzwhwfeXQD77ef74NLvhgTvegD66uPgbAf66+TvfADwjCzgcCfwiSD67ObhcjjwiBHhczvwiyrgbxj///777ujgcSHgcB/xiRzgbhveWgDeVwDhdEDgbRDqfgffYgDfXwD97+bvfQDxiz7//vvwiRr118rrcgztggbfZgDfZAD++PT98+3gbBPsgAb99vD33tPgcB7icAvuhAX//Pn66N/00sTyy7vuuqbjekLwhwzkcgr88er449n++vfutp/kh1vgcBvhbwvmdwnwgwDwgADeWQD87eLxxrTssJjqpIf0roHmjWTkhFP759n63czvvanomnjnlHDhczD22cr4y6/wwa/3xKX2wJ3rqpH0tY7qp4vpnoDymlbjf0vxjjntcwzldAroegj/kgX12s7518PzqnnnkWfynmLieUjpewjrdAD40Lj1uZTzpm3idTbiciLydQzzfwnyiQTsfgD3xqnzp3TxlkzgbCrdTwDdSwBLKUlNAAAAJ3RSTlP8/b2X/YH8wb+FAIuIggJbQin5opAM9+a/ubaubyD78NjSyr2WgRp4sjN4AAAI70lEQVR42u2cZ38SQRDGT8WGvfde4E4BxVMRRaKiUURRlJhQRDCCSgQVO/bee++9994+nMt5ywoezFJd/fm8uITi3p9n5mbYkcCpO6rVnVu2YEXd+3dRIySuo7pLv4GjGNKg7j3UHTl1l14PajmG9OFBnx7Ird4PumpYEtf1QXc112l0M7OGKXEfeg3guo3iNIyJG92Jaz61mYYxcaNacs1H/8f6j6X5j1WI/mMVIsawRFEzI49SjwOqAJa43emclk8Rp2c7AFZ+LDGyvXE2kmO2Q1Lq17RSd6ND48QIwFVuLNHTOPbEpTOz8ujMpccHGz0AV5mxIo4TpwUeUPj0YwfAVVYs0Tn7VZjnBUA8v+n6CyfERY8FR/DEJj7MQ6oL85vOvfDUAsuVC8s19s5yXuAppOPnvPk4EeSCsehCeBVTwVzHfE6RcFUQa4an8Qw91kpbw2oz4aoc1sSxniO0WAI/J24wriabmEpizZtM79bc+fr4/tUarEpiLabGElJYRsOGjbJfjGDpJCxtmosRLOEnVpqLESzZLYlLg65H1rAkLo2GESwcROwXI1jELcS1Y6OGQSzEVaupZQJLDiLhYtCtFBcbbslYhOueqKllDwtzwVhTq4RFuBh0C3EdEBl0C3OBWNUrEISLvSD+5GLQLYmLoSqfwcUiFuaqzhYDxiJc981lxqqdVsCGbHPcQLBgrtK3rwLt9tWqhblKxxI9hW3267U5ZHhuBrCKzXl4NIJTS5FrmbmMWGIEDZIouOp0/O6boYQ2jxBXWcdu13fzRILuF/2Ku+aGr96uBbhALHo5Z38+XcfXyVRZVx/+Ed513ldDCCCu0rFE0Xlo2mu5TAj8ki0XV0q6ePHilhi+d/15b9ACQGGusg3AFzc+XSMBCPzu89+CNlnB7zfD8t1z4iaLXUvDVT6sGdMOnv5pi47f6r9Qk9YF3xZ0l8S11UfMArlgLMpZM6bamYy6rWnta9q7TrZrzZPgPgoqg3atubY8WK6D8lQXHfb4p/wSK7vFfxmxSsAPQ96AlZ4LxoLNeompdkUDGQVznL5mLr4ar5ESD3PBWHA9fbpbjlT4pq1Bm6H6w9dwfOd69ePouNDYt3S3ULPGZ96S3YqtAW/Tepz1E8bgAANc+xEXhAX36ut1cslcd6rJq81SIvgEe7lmL3kY5iqxVYvOI9isswp22KeMOcrriJlWai5giwHl+yec73Ma9Mbfz+qOJndKz6hLpR5V1uPxavFuTTt0K1XfpbNeO0wKeUaR2IPBN5sMRlqu1eY8bsFmPeIFUpi0CjIGTLvSZY2EGeYSi3VL9Dgeb0I+SQl9MlcZT4TObZKzfmfS5NZSx1GsLQ5r+8Sxp7ERR/1TtDlUn2qNuGXCrZGM5URlLDiEVzDVkje5fdjXdDsm27XpXChBz4XG0UpYcDOMYaxjGc3wtyJxFtu1PohaI71f2K2imqEONcN4nrMZ9TWbMf81wg9z3VNwC26Gr3enY4ObobLqbccFefuz5AKONpVfzQp2y3NoVvrN32GLNl9orA22lTiM+Nqg5CJY1DueOjkwsdtNgAP7gidR2SWVhFqt3o9QwoKHIuiwDcwX+xT/UWztSlvCaqXGmtQBY1GadQmfh6anuE0XlkhhRFs3tGGkd+tuIVhiJN0M+brj0mlAu46lX0bcbizVLbgZrgwl4JhYA+NQa9TJQUetsSJYHscJvAVct7eJKoUbQudxPYmdirqzsYsIojhjoitD01yadH287J+vpZF1/uGt2K4ttinjshQo2C2XMzI2U64X6WY4tyZq99a7wZS3eA3BpNyrUPn1x00Z0uM1ACzilOfg7EN3VmRo8dN16WYYerYw6G9qCOSDCjQ0jQkufRbalt65LVyapaA/2mClxhK3Rxy3rsyavDxDR/DL5sMLFiyYu/7sXps7z8VldPv2Xl6PnjlTwOOuJQuytH7CXpvXCOQWoZrYeHWd4nw2Q+v22OLGnFSG0Nk1PCi0xjgjpVvTGi8hht9F+ARBGq8dtXmtOSLoDm1FhUSHnihkTecESalHkPAaWVhtFbA8jqvQGBmbt8fWkKtNn0Xw9GvAWK6DX9bBVHjzqtyvvcG9a+jXyC5oKoKV/a4YFG7Yij2ofszlgtaA3ZoRwW+pIOH3w0qZFURNh3oNtKsDsAr9LNvMC0pj93H6hTPpX9ocg8FIgTVvcgFYC03jFLBMi6ix0MDAoi8/lh7Cgt2q0VfNrSX0ayhjTa2IW0tKdotNrMq4NbPkILKZW+xdiSoGgshogfh7Ul7FcIEoFevfrPLC3+XWf6y/CEvHZoFQqlts9sQigqjLxFpQCJauakFcsqhKPXH79rGb6bE2B5Qmu0b91zn0WJtN8Wys9tgtIqfjEf2SWw7XKI8gHuKQ0X0eDsQSI44TaGBN6dYN5dlI/eFj9I7f8GWtoUJYOIgkiq6Ds/gw5T7dZDUqTrfscbLbB9eIB7JmEKsUgiii/4uO8ToBfJlhfif5tEGWEsGTMT4Mr6HDa0BBlP5Y88lcnkdkCtLhnyjMM0+Gcn2WzW6xnd/J8zn+LZq4SUeEvUBaA8LCs6Tk1p1AetXt3JoMWexWZSyr3RK6vSUGrRHbmkRUVgCLpP1HW/L4tgl5tO140mdKKFFhrkTUdxta4xleA8DCXC6n/vCYvPJFa9zAWL4m6qNaA8IiqjW73lreWnJrSj0AJYFZpvwq6RZRzjVUGEtB5tX7DdoqCXaL+PXHuEjdYsuvVqva4Sqv6NdabdW4YLeIKsoFYzHGhYPIGBd2izGuVpPaSVgAV7VEsOQgsuUXdosxLuwWxLVMW0WRK5ExLiiIpN4vq2YYVTiIbPmFgii5xRiXimCBqmIcVSS3WMqvdMqz5VcKqzdKeca4UrnVT/ryR6bi2Opuf64TwYJlfl4FLqu2Zxeux5BRXZnisvZ8103NqTtzoziuGa24+wZVRdVK9W7wyNSX1nYeOmrU6JSmjp6KhH5BR+kGvk++Ld0c/X66rPH4SEQeGl+kpq8a33eAumPqK347durWpzm9hrWhUevi1Hd4ZzVC+gGMHY0TYnDOYwAAAABJRU5ErkJggg=='.replace(/\+/g, '-').replace(/\//g, '_');

/**
 * Mime type for the paceholder thumbnail.
 */
DriveClient.prototype.placeholderMimeType = 'image/png';

/**
 * Executes the first step for connecting to Google Drive.
 */
DriveClient.prototype.libraryMimeType = 'application/vnd.jgraph.mxlibrary';

/**
 * Contains the hostname of the new app.
 */
DriveClient.prototype.newAppHostname = 'www.draw.io';

/**
 * Executes the first step for connecting to Google Drive.
 */
DriveClient.prototype.extension = '.drawio';

/**
 * Interval for updating the access token.
 */
DriveClient.prototype.tokenRefreshInterval = 0;

/**
 * Interval for updating the access token.
 */
DriveClient.prototype.lastTokenRefresh = 0;

/**
 * Executes the first step for connecting to Google Drive.
 */
DriveClient.prototype.maxRetries = 5;

/**
 * Executes the first step for connecting to Google Drive.
 */
DriveClient.prototype.coolOff = 1000;

/**
 * Executes the first step for connecting to Google Drive.
 */
DriveClient.prototype.mimeTypeCheckCoolOff = 60000;

/**
 * Executes the first step for connecting to Google Drive.
 */
DriveClient.prototype.user = null;

/**
 * Authorizes the client, gets the userId and calls <open>.
 */
DriveClient.prototype.setUser = function(user)
{
	this.user = user;
	
	if (this.user == null)
	{
		this.userId = null;
		
		if (this.tokenRefreshThread != null)
		{
			window.clearTimeout(this.tokenRefreshThread);
			this.tokenRefreshThread = null;
		}
	}
	else
	{
		this.userId = user.id;
	}
	
	this.fireEvent(new mxEventObject('userChanged'));
};

DriveClient.prototype.setUserId = function(userId)
{
	this.userId = userId;
	
	if (this.user != null && this.user.id != this.userId)
	{
		this.user = null;
	}
};
/**
 * Authorizes the client, gets the userId and calls <open>.
 */
DriveClient.prototype.getUser = function()
{
	return this.user;
};

DriveClient.prototype.getUsersList = function()
{
	var users = [];
	var authInfo = JSON.parse(this.getPersistentToken(true));
	var curUserId = null;
	
	if (authInfo != null)
	{
		if (authInfo.current != null)
		{
			curUserId = authInfo.current.userId;
			users.push(authInfo[curUserId].user);
			users[0].isCurrent = true;
			
		}
		
		for (var id in authInfo)
		{
			if (id == 'current' || id == curUserId) continue;
			
			users.push(authInfo[id].user);
		}
	}
	return users;
};

DriveClient.prototype.logout = function()
{
	this.clearPersistentToken();
	this.setUser(null);
	this.token = null;
};

/**
 * Authorizes the client, gets the userId and calls <open>.
 */
DriveClient.prototype.execute = function(fn)
{
	// Handles error in immediate authorize call via callback that shows a
	// UI with a button that executes the second non-immediate authorize
	var fallback = mxUtils.bind(this, function(resp)
	{
		// Remember is an argument for the callback that executes
		// when the user clicks the authorize button in the UI and
		// success executes after successful authorization.
		this.ui.showAuthDialog(this, true, mxUtils.bind(this, function(remember, success)
		{
			this.authorize(false, mxUtils.bind(this, function()
			{
				if (success != null)
				{
					success();
				}
				
				fn();
			}), mxUtils.bind(this, function(resp)
			{
				var msg = mxResources.get('cannotLogin');
				
				// Handles special domain policy errors
				if (resp != null && resp.error != null)
				{
					if (resp.error.code == 403 &&
						resp.error.data != null && resp.error.data.length > 0 &&
						resp.error.data[0].reason == 'domainPolicy')
					{
						msg = resp.error.message;
					}
				}
				
				this.logout();
				
				this.ui.showError(mxResources.get('error'), msg, mxResources.get('help'), mxUtils.bind(this, function()
				{
					this.ui.openLink('https://desk.draw.io/support/solutions/articles/16000074659');
				}), null, mxResources.get('ok'));
			}), remember);
		}));
	});
	
	// First immediate authorize attempt
	this.authorize(true, fn, fallback);
};

/**
 * Executes the given request.
 */
DriveClient.prototype.executeRequest = function(reqObj, success, error)
{
	try
	{
		var acceptResponse = true;
		var timeoutThread = null;
		var retryCount = 0;
		
		// Cancels any pending requests
		if (this.requestThread != null)
		{
			window.clearTimeout(this.requestThread);
		}
		
		var fn = mxUtils.bind(this, function()
		{
			try
			{
				this.requestThread = null;
				this.currentRequest = reqObj;
		
				if (timeoutThread != null)
				{
					window.clearTimeout(timeoutThread);
				}
				
				timeoutThread = window.setTimeout(mxUtils.bind(this, function()
				{
					acceptResponse = false;
					
					if (error != null)
					{
						error({code: App.ERROR_TIMEOUT, message: mxResources.get('timeout'), retry: fn});
					}
				}), this.ui.timeout);
				
				var params = null;
				var isJSON = false;
				
				if (typeof reqObj.params === 'string')
				{ 
					params = reqObj.params; 
				}
				else if (reqObj.params != null)
				{
					params = JSON.stringify(reqObj.params);
					isJSON = true;
				}
				
				var url = reqObj.fullUrl || (this.GDriveBaseUrl + reqObj.url);
				
				if (isJSON)
				{
					url += (url.indexOf('?') > 0 ? '&' : '?') + 'alt=json';					
				}
						
				var req = new mxXmlRequest(url, params, reqObj.method || 'GET');
				
				req.setRequestHeaders = mxUtils.bind(this, function(request, params)
				{
					if (reqObj.headers != null)
					{
						for (var key in reqObj.headers)
						{
							request.setRequestHeader(key, reqObj.headers[key]);
						}
					}
					else if (reqObj.contentType != null)
					{
						request.setRequestHeader('Content-Type', reqObj.contentType);
					}
					else if (isJSON)
					{
						request.setRequestHeader('Content-Type', 'application/json');
					}
					
					request.setRequestHeader('Authorization', 'Bearer ' + this.token);
				});
				
				req.send(mxUtils.bind(this, function(req)
				{
					try
					{
						window.clearTimeout(timeoutThread);
						
						if (acceptResponse)
						{
							var resp;
							
							try
							{
								resp = JSON.parse(req.getText());
							}
							catch(e) 
							{
								resp = null;
							}
							
							if (req.getStatus() >= 200 && req.getStatus() <= 299)
							{
								if (success != null)
								{
									success(resp);
								}
							}
							else
							{
								// Errors for put request are in data instead of errors
								var data = (resp != null && resp.error != null) ? ((resp.error.data != null) ?
									resp.error.data : resp.error.errors) : null;
								var reason = (data != null && data.length > 0) ? data[0].reason : null; 
								
								// Handles special error for saving old file where mime was changed to new
								// LATER: Check if 403 is never auth error, for now we check the message for a specific
								// case where the old app mime type was overridden by the new app
								if (error != null && resp != null && resp.error != null && (resp.error.code == -1 ||
									(resp.error.code == 403 && (reason == 'domainPolicy' || resp.error.message ==
									'The requested mime type change is forbidden.'))))
								{
									error(resp);
								}
								// Handles authentication error
								else if (resp != null && resp.error != null && (resp.error.code == 401 ||
									(resp.error.code == 403 && reason != 'rateLimitExceeded')))
								{
									// Shows an error if re-authenticated but the server still doesn't allow it
									if ((resp.error.code == 403 && this.retryAuth) ||
										(resp.error.code == 401 && this.retryAuth && reason == 'authError'))
									{
										if (error != null)
										{
											error(resp);
										}
										
										this.retryAuth = false;
									}
									else
									{
										this.retryAuth = true;
										this.execute(fn);
									}
								}
								// Schedules a retry if no new request was executed
								else if (resp != null && resp.error != null && resp.error.code != 412 && resp.error.code != 404 &&
									resp.error.code != 400 && this.currentRequest == reqObj && retryCount < this.maxRetries)
								{
									retryCount++;
									var jitter = 1 + 0.1 * (Math.random() - 0.5);
									this.requestThread = window.setTimeout(fn,
										Math.round(Math.pow(2, retryCount) *
										jitter * this.coolOff));
								}
								else if (error != null)
								{
									error(resp);
								}
							}
						}
					}
					catch (e)
					{
						if (error != null)
						{
							error(e);
						}
						else
						{
							throw e;
						}
					}
				}));
			}
			catch (e)
			{
				if (error != null)
				{
					error(e);
				}
				else
				{
					throw e;
				}
			}
		});
		
		// Must get token before first request in this case
		if (this.token == null || !this.authCalled)
		{
			this.execute(fn);
		}
		else
		{
			fn();
		}
	}
	catch (e)
	{
		if (error != null)
		{
			error(e);
		}
		else
		{
			throw e;
		}
	}
};

DriveClient.prototype.createAuthWin = function(url)
{
	var width = 525,
	height = 525,
	screenX = window.screenX,
	screenY = window.screenY,
	outerWidth = window.outerWidth,
	outerHeight = window.outerHeight;

	var left = screenX + Math.max(outerWidth - width, 0) / 2;
	var top = screenY + Math.max(outerHeight - height, 0) / 2;
	
	var features = ['width=' + width, 'height=' + height,
	                'top=' + top, 'left=' + left,
	                'status=no', 'resizable=yes',
	                'toolbar=no', 'menubar=no',
	                'scrollbars=yes'];
	return window.open(url? url : 'about:blank', 'gdauth', features.join(','));	
};

/**
 * Authorizes the client, gets the userId and calls <open>.
 */
DriveClient.prototype.authorize = function(immediate, success, error, remember, popup)
{
	var updateAuthInfo = mxUtils.bind(this, function (newAuthInfo, remember, forceUserUpdate)
	{
		this.token = newAuthInfo.access_token;
		newAuthInfo.expires = Date.now() + parseInt(newAuthInfo.expires_in) * 1000;
		newAuthInfo.remember = remember;
		
		this.resetTokenRefresh(newAuthInfo);
		this.authCalled = true;
		
		if (forceUserUpdate || this.user == null)
		{
			//IE/Edge security doesn't allow access to newAuthInfo in a callback function (outside this function scope)
			//So, stringify the object and restore it (parse) in the callback
			var strAuthInfo = JSON.stringify(newAuthInfo);

			this.updateUser(mxUtils.bind(this, function()
			{
				//Restore the auth info object to bypass IE/Edge security
				var resAuthInfo = JSON.parse(strAuthInfo);
				//Save user and new token
				this.setPersistentToken(resAuthInfo, !remember);
				
				if (success != null)
				{
					success();
				}											
			}), error);
		}
		else if (success != null)
		{
			this.setPersistentToken(newAuthInfo, !remember);
			success();
		}
	});
	
	try
	{
		// Takes userId from state URL parameter
		if (this.ui.stateArg != null && this.ui.stateArg.userId != null)
		{
			this.userId = this.ui.stateArg.userId;
			
			if (this.user != null && this.user.id != this.userId)
			{
				this.user = null;
			}
		}
		
		//Retry request with refreshed token
		var authInfo = JSON.parse(this.getPersistentToken(true));
		
		if (authInfo != null)
		{
			if (this.userId == null)
			{
				if (authInfo.current != null)
				{
					this.userId = authInfo.current.userId;
					authInfo = authInfo[this.userId];
				}
				else
				{
					authInfo = null;
				}
			}
			else
			{
				authInfo = authInfo[this.userId]; //If user id is new, authInfo will be null
			}
		}
		
		// Immediate only possible with a refresh token
		if (immediate && (authInfo == null || authInfo.refresh_token == null))
		{
			if (error != null)
			{
				error();
			}
		}
		else
		{
			if (immediate) //Note, we checked refresh token is not null above
			{
				//state is used to identify which app is used
				var req = new mxXmlRequest(this.redirectUri + '?state=appIndex%3D' + this.appIndex + '&refresh_token=' + authInfo.refresh_token, null, 'GET');
				
				req.send(mxUtils.bind(this, function(req)
				{
					if (req.getStatus() >= 200 && req.getStatus() <= 299)
					{
						var newAuthInfo = JSON.parse(req.getText());
						newAuthInfo.refresh_token = authInfo.refresh_token; //Refresh token is not returned in the new auth info
						
						updateAuthInfo(newAuthInfo, true); //We set remember to true since we can only have a refresh token if user initially selected remember
					}
					else 
					{
						//When the request fails (e.g, Hibernate on Windows), the status is 0, this doesn't mean the token is invalid
						if (req.getStatus() != 0) 
						{
							this.logout();
						}

						if (error != null)
						{
							error(req); //TODO review this code path and how error is handled
						}
					}
				}), error);
			}
			else
			{
				var url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + this.clientId +
						'&redirect_uri=' + encodeURIComponent(this.redirectUri) + 
						'&response_type=code&include_granted_scopes=true' +
						(remember? '&access_type=offline&prompt=consent%20select_account' : '') + //Ask for consent again to get a new refresh token
						'&scope=' + encodeURIComponent(this.scopes.join(' ')) +
						'&state=appIndex%3D' + this.appIndex; //To identify which app is used
				
				if (popup == null)
				{
					popup = this.createAuthWin(url);
				}
				else
				{
					popup.location = url;
				}
				
				if (popup != null)
				{
					window.onGoogleDriveCallback = mxUtils.bind(this, function(newAuthInfo, authWindow)
					{
						window.onGoogleDriveCallback = null;
						
						try
						{
							if (newAuthInfo == null)
							{
								if (error != null)
								{
									error({message: mxResources.get('accessDenied')}); //TODO Check this error handling is correct
								}
							}
							else
							{
								updateAuthInfo(newAuthInfo, remember, true);
							}
						}
						catch (e)
						{
							if (error != null)
							{
								error(e);
							}
						}
						finally
						{
							if (authWindow != null)
							{
								authWindow.close();
							}
						}
					});
				
					popup.focus();
				}
			}
		}
	}
	catch (e)
	{
		if (error != null)
		{
			error(e);
		}
		else
		{
			throw e;
		}
	}
};

/**
 * Checks if the client is authorized and calls the next step.
 */
DriveClient.prototype.resetTokenRefresh = function(resp)
{
	if (this.tokenRefreshThread != null)
	{
		window.clearTimeout(this.tokenRefreshThread);
		this.tokenRefreshThread = null;
	}

	// Starts timer to refresh token before it expires
	if (resp != null && resp.error == null && resp.expires_in > 0)
	{
		this.tokenRefreshInterval = parseInt(resp.expires_in) * 1000;
		this.lastTokenRefresh = new Date().getTime();
		
		this.tokenRefreshThread = window.setTimeout(mxUtils.bind(this, function()
		{
			this.authorize(true, mxUtils.bind(this, function()
			{
				//console.log('tokenRefresh: refreshed', this.token);
			}), mxUtils.bind(this, function()
			{
				//console.log('tokenRefresh: error refreshing', this.token);
			}));
		}), resp.expires_in * 900);
	}
};

/**
 * Checks if the client is authorized and calls the next step.
 */
DriveClient.prototype.checkToken = function(fn)
{
	var connected = this.lastTokenRefresh > 0;
	var delta = new Date().getTime() - this.lastTokenRefresh;

	if (delta > this.tokenRefreshInterval || this.tokenRefreshThread == null)
	{
		// Uses execute instead of authorize to allow a fallback authorization if cookie was lost
		this.execute(mxUtils.bind(this, function()
		{
			fn();
			
			if (connected)
			{
				this.fireEvent(new mxEventObject('disconnected'));
			}
		}));
	}
	else
	{
		fn();
	}
};

/**
 * Checks if the client is authorized and calls the next step.
 */
DriveClient.prototype.updateUser = function(success, error)
{
	try
	{
		var url = 'https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=' + this.token;
		
		this.ui.loadUrl(url, mxUtils.bind(this, function(data)
		{
	    	var info = JSON.parse(data);
	    	
	    	// Requests more information about the user (email address is sometimes not in info)
	    	this.executeRequest({url: '/about'}, mxUtils.bind(this, function(resp)
	    	{
	    		var email = mxResources.get('notAvailable');
	    		var name = email;
	    		var pic = null;
	    		
	    		if (resp != null && resp.user != null)
	    		{
	    			email = resp.user.emailAddress;
	    			name = resp.user.displayName;
	    			pic = (resp.user.picture != null) ? resp.user.picture.url : null;
	    		}
	    		
	    		this.setUser(new DrawioUser(info.id, email, name, pic, info.locale));
	    		this.userId = info.id;
	
	    		if (success != null)
				{
					success();
				}
	    	}), error);
		}), error);
	}
	catch (e)
	{
		if (error != null)
		{
			error(e);
		}
		else
		{
			throw e;
		}
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.copyFile = function(id, title, success, error)
{
	if (id != null && title != null)
	{
		this.executeRequest({url: '/files/' + id + '/copy?fields=' + encodeURIComponent(this.allFields)
				+ '&supportsTeamDrives=true', //&alt=json
				method: 'POST',
				params: {'title': title, 'properties':
					[{'key': 'channel', 'value': Editor.guid()}]}
			}, success, error);
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.renameFile = function(id, title, success, error)
{
	if (id != null && title != null)
	{
		this.executeRequest(this.createDriveRequest(
			id, {'title' : title}), success, error);
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.moveFile = function(id, folderId, success, error)
{
	if (id != null && folderId != null)
	{
		this.executeRequest(this.createDriveRequest(id, {'parents': [{'kind':
			'drive#fileLink', 'id': folderId}]}), success, error);
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.createDriveRequest = function(id, body)
{
	return {
		'url': '/files/' + id + '?uploadType=multipart&supportsTeamDrives=true',
		'method': 'PUT',
		'contentType': 'application/json; charset=UTF-8',
		'params': body
	};
};

/**
 * Loads the given file as a library file.
 */
DriveClient.prototype.getLibrary = function(id, success, error)
{
	return this.getFile(id, success, error, true, true);
};

/**
 * Loads the descriptorf for the given file ID.
 */
DriveClient.prototype.loadDescriptor = function(id, success, error, fields)
{
	this.executeRequest({
		url: '/files/' + id + '?supportsTeamDrives=true&fields=' + (fields != null ? fields : this.allFields)
	}, success, error);
};

/**
 * Gets the channel ID from the given descriptor.
 */
DriveClient.prototype.getCustomProperty = function(desc, key)
{
	var props = desc.properties;
	var result = null;
	
	if (props != null)
	{
		for (var i = 0; i < props.length; i++)
		{
			if (props[i].key == key)
			{
				result = props[i].value;

				break;
			}
		}
	}
	
	return result;
};

/**
 * Checks if the client is authorized and calls the next step. The optional
 * readXml argument is used for import. Default is false. The optional
 * readLibrary argument is used for reading libraries. Default is false.
 */
DriveClient.prototype.getFile = function(id, success, error, readXml, readLibrary)
{
	readXml = (readXml != null) ? readXml : false;
	readLibrary = (readLibrary != null) ? readLibrary : false;
	
	if (urlParams['rev'] != null)
	{
		this.executeRequest({
				url: '/files/' + id + '/revisions/' + urlParams['rev'] + '?supportsTeamDrives=true'
			},
			mxUtils.bind(this, function(resp)
			{
				// Redirects title to originalFilename to
				// match expected descriptor interface
				resp.title = resp.originalFilename;
				
				// Uses ID of file instead of revision ID in descriptor
				// to avoid a change of the document hash property
				resp.headRevisionId = resp.id;
				resp.id = id;

   				this.getXmlFile(resp, success, error);
			}), error);
	}
	else
	{
		this.loadDescriptor(id, mxUtils.bind(this, function(resp)
		{
			try
			{
				if (this.user != null)
				{
					var binary = /\.png$/i.test(resp.title);
					
					// Handles .vsdx, .vsd, .vdx, Gliffy and PNG+XML files by creating a temporary file
					if (/\.v(dx|sdx?)$/i.test(resp.title) || /\.gliffy$/i.test(resp.title) ||
						(!this.ui.useCanvasForExport && binary))
					{
						var url = resp.downloadUrl + '&access_token=' + this.token;
						this.ui.convertFile(url, resp.title, resp.mimeType, this.extension, success, error);
					}
					else
					{
						// Handles converted realtime files as XML files
						if (readXml || readLibrary || resp.mimeType == this.libraryMimeType ||
							resp.mimeType == this.xmlMimeType)
						{
							this.getXmlFile(resp, success, error, true, readLibrary);
						}
						else
						{
							this.getXmlFile(resp, success, error);
						}
					}
				}
				else
				{
					error({message: mxResources.get('loggedOut')});
				}
			}
			catch (e)
			{
				if (error != null)
				{
					error(e);
				}
				else
				{
					throw e;
				}
			}
		}), error);
	}
};

/**
 * Returns true if the given mime type is for Google Realtime files.
 */
DriveClient.prototype.isGoogleRealtimeMimeType = function(mimeType)
{
	return mimeType != null && mimeType.substring(0, 30) == 'application/vnd.jgraph.mxfile.';
};

/**
 * Checks if the client is authorized and calls the next step. The ignoreMime argument is
 * used for import via getFile. Default is false. The optional
 * readLibrary argument is used for reading libraries. Default is false.
 */
DriveClient.prototype.getXmlFile = function(resp, success, error, ignoreMime, readLibrary)
{
	try
	{
		var url = resp.downloadUrl + '&access_token=' + this.token;
		
		// Loads XML to initialize realtime document if realtime is empty
		this.ui.loadUrl(url, mxUtils.bind(this, function(data)
		{
			try
			{
				if (data == null)
				{
					// TODO: Optional redirect to legacy if link is for old file
					error({message: mxResources.get('invalidOrMissingFile')});
				}
				else if (resp.mimeType == this.libraryMimeType || readLibrary)
				{
					if (resp.mimeType == this.libraryMimeType && !readLibrary)
					{
						error({message: mxResources.get('notADiagramFile')});
					}
					else
					{
						success(new DriveLibrary(this.ui, data, resp));
					}
				}
				else
				{
					var importFile = false;
					
					if (/\.png$/i.test(resp.title))
					{
						var index = data.lastIndexOf(',');
						
						if (index > 0)
						{
							var xml = this.ui.extractGraphModelFromPng(data.substring(index + 1));
							
							if (xml != null && xml.length > 0)
							{
								data = xml;
							}
							else
							{
								// Checks if the file contains XML data which can happen when we insert
								// the file and then don't post-process it when loaded into the UI which
								// is required for creating the images for .PNG and .SVG files.
								try
								{
									var xml = data.substring(index + 1);
									var temp = (window.atob && !mxClient.IS_IE && !mxClient.IS_IE11) ?
										atob(xml) : Base64.decode(xml);
									var node = this.ui.editor.extractGraphModel(
										mxUtils.parseXml(temp).documentElement, true);
									
									if (node == null || node.getElementsByTagName('parsererror').length > 0)
									{
										importFile = true;
									}
									else
									{
										data = temp;
									}
								}
								catch (e)
								{
									importFile = true;
								}
							}
						}
					}
					// Checks for base64 encoded mxfile
					else if (data.substring(0, 32) == 'data:image/png;base64,PG14ZmlsZS')
					{
						var temp = data.substring(22);
						data = (window.atob && !mxClient.IS_SF) ? atob(temp) : Base64.decode(temp);
					}
					
					if (Graph.fileSupport && new XMLHttpRequest().upload && this.ui.isRemoteFileFormat(data, url))
					{
						this.ui.parseFile(new Blob([data], {type: 'application/octet-stream'}), mxUtils.bind(this, function(xhr)
						{
							try
							{
								if (xhr.readyState == 4)
								{
									if (xhr.status >= 200 && xhr.status <= 299)
									{
										success(new LocalFile(this.ui, xhr.responseText, resp.title + this.extension, true));
									}
									else if (error != null)
									{
										error({message: mxResources.get('errorLoadingFile')});
									}
								}
							}
							catch (e)
							{
								if (error != null)
								{
									error(e);
								}
								else
								{
									throw e;
								}
							}
						}), resp.title);
					}
					else
					{
						success((importFile) ? new LocalFile(this.ui, data, resp.title, true) : new DriveFile(this.ui, data, resp));
					}
				}
			}
			catch (e)
			{
				if (error != null)
				{
					error(e);
				}
				else
				{
					throw e;
				}
			}
		}), error, ((resp.mimeType != null && resp.mimeType.substring(0, 6) == 'image/' &&
			resp.mimeType.substring(0, 9) != 'image/svg')) || /\.png$/i.test(resp.title) ||
			/\.jpe?g$/i.test(resp.title));
	}
	catch (e)
	{
		if (error != null)
		{
			error(e);
		}
		else
		{
			throw e;
		}
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.saveFile = function(file, revision, success, errFn, noCheck, unloading, overwrite, properties)
{
	try
	{
		file.saveLevel = 1;
		
		var error = mxUtils.bind(this, function(e)
		{
			file.saveLevel = 11;
			
			if (errFn != null)
			{
				errFn(e);
			}
			else
			{
				throw e;
			}
			
			// Logs failed save
			try
			{
				if (!file.isConflict(e))
				{
					var err = 'error_' + (file.getErrorMessage(e) || 'unknown');
	
					if (e != null && e.error != null && e.error.code != null)
					{
						err += '-code_' + e.error.code;
					}
					
					EditorUi.logEvent({category: 'ERROR-SAVE-FILE-' + file.getHash() + '-rev_' +
						file.desc.headRevisionId + '-mod_' + file.desc.modifiedDate +
							'-size_' + file.getSize() + '-mime_' + file.desc.mimeType +
						((this.ui.editor.autosave) ? '' : '-nosave') +
						((file.isAutosave()) ? '' : '-noauto') +
						((file.changeListenerEnabled) ? '' : '-nolisten') +
						((file.inConflictState) ? '-conflict' : '') +
						((file.invalidChecksum) ? '-invalid' : ''),
						action: err, label: ((this.user != null) ? ('user_' + this.user.id) : 'nouser') +
						((file.sync != null) ? ('-client_' + file.sync.clientId) : '-nosync')});
				}
			}
			catch (ex)
			{
				// ignore
			}
		});
		
		var criticalError = mxUtils.bind(this, function(e)
		{
			error(e);
			file.saveLevel = 12;
	
			try
			{
				EditorUi.logError(e.message, null, null, e);
				
				EditorUi.sendReport('Critical error in DriveClient.saveFile ' +
					new Date().toISOString() + ':' +
					'\n\nBrowser=' + navigator.userAgent +
					'\nFile=' + file.desc.id + '.' + file.desc.headRevisionId +
					'\nUser=' + ((this.user != null) ? this.user.id : 'nouser') +
					 	((file.sync != null) ? '-client_' + file.sync.clientId : '-nosync') +
					'\nMessage=' + e.message +
					'\n\nStack:\n' + e.stack);
			}
			catch (e)
			{
				// ignore
			}
		});

		if (file.isEditable() && file.desc != null)
		{
			var t0 = new Date().getTime();
			var etag0 = file.desc.etag;
			var mod0 = file.desc.modifiedDate;
			var head0 = file.desc.headRevisionId;
			var saveAsPng = this.ui.useCanvasForExport && /(\.png)$/i.test(file.getTitle());
			noCheck = (noCheck != null) ? noCheck : urlParams['ignoremime'] == '1';
			
			// NOTE: Unloading arg is currently ignored, saving during unload/beforeUnload is not possible using
			// asynchronous code, which is needed to create the thumbnail, or asynchronous requests which is the only
			// way to execute the gapi request below.
			// If no thumbnail is created and noCheck is true (which is always true if unloading is true) in which case
			// this code is synchronous, the executeRequest call is reached but the request is still not sent. This is
			// true for both, calls from beforeUnload and unload handlers. Note sure how to make the call synchronous
			// which is said to fix this when called from beforeUnload.
			// However, this would result in a missing thumbnail in most cases so a better solution might be to reduce
			// the autosave interval in DriveRealtime, but that would increase the number of requests.
			unloading = (unloading != null) ? unloading : false;
			
			// Adds optional thumbnail to upload request
			var doSave = mxUtils.bind(this, function(thumb, thumbMime, keepExisting)
			{
				try
				{
					file.saveLevel = 3;
					var prevDesc = null;
					var pinned = false;
					var meta =
					{
						'mimeType': file.desc.mimeType,
						'title': file.getTitle()
					};
					
					// Overrides old mime type and creates a revision
					if (this.isGoogleRealtimeMimeType(file.desc.mimeType))
					{
						meta.mimeType = this.xmlMimeType;
						prevDesc = file.desc;
						revision = true;
						pinned = true;
					}
					// Overrides mime type for unknown file type uploads
					else if (meta.mimeType == 'application/octet-stream')
					{
						meta.mimeType = this.xmlMimeType;
					}
					
					if (file.constructor == DriveFile)
					{
						if (properties == null)
						{
							properties = [];
						}
		
						// Channel ID appended to file ID for comms
						if (file.getChannelId() == null)
						{
							properties.push({'key': 'channel', 'value': Editor.guid(32)});
						}
		
						// Key for encryption of comms
						if (file.getChannelKey() == null)
						{
							properties.push({'key': 'key', 'value': Editor.guid(32)});
						}
						
						// Pass to access cache for each etag
						properties.push({'key': 'secret', 'value': Editor.guid(32)});
					}
					
					// Specifies that no thumbnail should be uploaded in which case the existing thumbnail is used
					if (!keepExisting)
					{
						// Uses placeholder thumbnail to replace existing one except when unloading
						// in which case the XML is updated but the existing thumbnail is not in order
						// to avoid executing asynchronous code and get the XML to the server instead
						if (thumb == null && !unloading)
						{
							thumb = this.placeholderThumbnail;
							thumbMime = this.placeholderMimeType;
						}
						
						// Adds metadata for thumbnail
						if (thumb != null && thumbMime != null)
						{
							meta.thumbnail =
							{
								'image': thumb,
								'mimeType': thumbMime
							};
						}
					}
		
					var savedData = file.getData();
					
					// Updates saveDelay on drive file
					var wrapper = mxUtils.bind(this, function(resp)
					{
						try
						{
							file.saveDelay = new Date().getTime() - t0;
							
							// Checks if modified time is in the future and head revision has changed
							var delta = new Date(resp.modifiedDate).getTime() - new Date(mod0).getTime();
							
							if (delta <= 0 || etag0 == resp.etag || (revision && head0 == resp.headRevisionId))
							{
								var reasons = [];
								
								if (delta <= 0)
								{
									reasons.push('invalid modified time');
								}
								
								if (etag0 == resp.etag)
								{
									reasons.push('stale etag');
								}
								
								if (revision && head0 == resp.headRevisionId)
								{
									reasons.push('stale revision');
								}
								
								var temp = reasons.join(', ');
								error({message: mxResources.get('errorSavingFile') + ': ' + temp}, resp);
								
								// Logs failed save
								try
								{
									EditorUi.sendReport('Critical: Error saving to Google Drive ' +
										new Date().toISOString() + ':' + '\n\nBrowser=' + navigator.userAgent +
										'\nFile=' + file.desc.id + ' ' + file.desc.mimeType +
										'\nUser=' + ((this.user != null) ? this.user.id : 'nouser') +
										 	((file.sync != null) ? '-client_' + file.sync.clientId : '-nosync') +
										'\nErrors=' + temp + '\nOld=' + head0 + ' ' + mod0 + ' etag-hash=' +
										this.ui.hashValue(etag0) + '\nNew=' + resp.headRevisionId + ' ' +
										resp.modifiedDate + ' etag-hash=' + this.ui.hashValue(resp.etag))
									EditorUi.logError('Critical: Error saving to Google Drive ' + file.desc.id,
										null, 'from-' + head0 + '.' + mod0 + '-' + this.ui.hashValue(etag0) +
										'-to-' + resp.headRevisionId + '.' + resp.modifiedDate + '-' +
										this.ui.hashValue(resp.etag) + ((temp.length > 0) ? '-errors-' + temp : ''),
										'user-' + ((this.user != null) ? this.user.id : 'nouser') +
									 	((file.sync != null) ? '-client_' + file.sync.clientId : '-nosync'));
								}
								catch (e)
								{
									// ignore
								}
							}
							else
							{
								file.saveLevel = null;
						    	success(resp, savedData);
		
						    	if (prevDesc != null)
								{
						    		// Pins previous revision
									this.executeRequest({
										url: '/files/' + prevDesc.id + '/revisions/' + prevDesc.headRevisionId + '?supportsTeamDrives=true'
									}, mxUtils.bind(this, mxUtils.bind(this, function(resp)
									{
										resp.pinned = true;
										
										this.executeRequest({
											url: '/files/' + prevDesc.id + '/revisions/' + prevDesc.headRevisionId,
											method: 'PUT',
											params: resp
										});
									})));
									
									// Logs conversion
									try
									{
										EditorUi.logEvent({category: file.convertedFrom + '-CONVERT-FILE-' + file.getHash(),
											action: 'from_' + prevDesc.id + '.' + prevDesc.headRevisionId +
											'-to_' + file.desc.id + '.' + file.desc.headRevisionId,
											label: (this.user != null) ? ('user_' + this.user.id) : 'nouser' +
											((file.sync != null) ? '-client_' + file.sync.clientId : 'nosync')});
									}
									catch (e)
									{
										// ignore
									}
								}
						    	
								// Logs successful save
								try
								{
									EditorUi.logEvent({category: 'SUCCESS-SAVE-FILE-' + file.getHash() +
										'-rev0_' + head0 + '-mod0_' + mod0,
										action: 'rev-' + resp.headRevisionId +
										'-mod_' + resp.modifiedDate + '-size_' + file.getSize() +
										'-mime_' + file.desc.mimeType +
										((this.ui.editor.autosave) ? '' : '-nosave') +
										((file.isAutosave()) ? '' : '-noauto') +
										((file.changeListenerEnabled) ? '' : '-nolisten') +
										((file.inConflictState) ? '-conflict' : '') +
										((file.invalidChecksum) ? '-invalid' : ''),
										label: ((this.user != null) ? ('user_' + this.user.id) : 'nouser') +
										((file.sync != null) ? ('-client_' + file.sync.clientId) : '-nosync')});
								}
								catch (e)
								{
									// ignore
								}
							}
						}
						catch (e)
						{
							criticalError(e);
						}
					});
					
					var doExecuteRequest = mxUtils.bind(this, function(data, binary)
					{
						file.saveLevel = 4;
						
						try
						{
							if (properties != null)
							{
								meta.properties = properties;
							}
			
							// Used to check if file was changed externally
							var etag = (!overwrite && file.constructor == DriveFile &&
								(DrawioFile.SYNC == 'manual' || DrawioFile.SYNC == 'auto')) ?
								file.getCurrentEtag() : null;
							var retryCount = 0;
							
							var doExecuteSave = mxUtils.bind(this, function(realOverwrite)
							{
								file.saveLevel = 5;
								
								try
								{
									var unknown = file.desc.mimeType != this.xmlMimeType && file.desc.mimeType != this.mimeType &&
										file.desc.mimeType != this.libraryMimeType;
									var acceptResponse = true;
									
									// Allow for re-auth flow with 3x timeout
									var timeoutThread = window.setTimeout(mxUtils.bind(this, function()
									{
										acceptResponse = false;
										error({code: App.ERROR_TIMEOUT, message: mxResources.get('timeout')});
									}), 3 * this.ui.timeout);
									
									this.executeRequest(this.createUploadRequest(file.getId(), meta,
										data, revision || realOverwrite || unknown, binary,
										(realOverwrite) ? null : etag, pinned), mxUtils.bind(this, function(resp)
									{
										window.clearTimeout(timeoutThread);
										
										if (acceptResponse)
										{
											wrapper(resp);
										}
									}), mxUtils.bind(this, function(err)
									{
										window.clearTimeout(timeoutThread);
										
										if (acceptResponse)
										{
											file.saveLevel = 6;
												
											try
											{
												if (!file.isConflict(err))
												{
													error(err);
												}
												else
												{
													// Check for stale etag which can happen if a file is being saved or if
													// the etag simply isn't change but system still returns a 412 error (stale)
													this.executeRequest({
														url: '/files/' + file.getId() + '?supportsTeamDrives=true&fields=' + this.catchupFields
													}, 
													mxUtils.bind(this, function(resp)
													{
														file.saveLevel = 7;
	
														try
														{
															// Stale etag detected, retry with delay
															if (resp != null && resp.etag == etag)
															{
																if (retryCount < this.maxRetries)
																{
																	retryCount++;
																	var jitter = 1 + 0.1 * (Math.random() - 0.5);
																	var delay = retryCount * 2 * this.coolOff * jitter;
																	window.setTimeout(executeSave, delay);
																}
																else
																{
																	executeSave(true);
																	
																	// Logs overwrite
																	try
																	{
																		EditorUi.logError('Warning: Stale Etag Overwrite ' + file.getHash(),
																			null, file.desc.id + '.' + file.desc.headRevisionId,
																			((this.user != null) ? ('user_' + this.user.id) : 'nouser') +
																			((file.sync != null) ? ('-client_' + file.sync.clientId) : '-nosync'));
																	}
																	catch (e)
																	{
																		// ignore
																	}
																}
															}
															else
															{

																if (urlParams['test'] == '1' && resp.headRevisionId == head0)
																{
																	EditorUi.debug('DriveClient: Remote Etag Changed',
																		'local', etag, 'remote', resp.etag,
																		'rev', file.desc.headRevisionId,
																		'response', [resp], 'file', [file]);
																}
																
																error(err, resp);
															}
														}
														catch (e)
														{
															criticalError(e);
														}
													}), mxUtils.bind(this, function()
													{
														error(err);
													}));
												}
											}
											catch (e)
											{
												criticalError(e);
											}
										}
									}));
								}
								catch (e)
								{
									criticalError(e);
								}
							});

							// Workaround for Google returning the wrong etag after file save is to
							// update the etag before save and check if the headRevisionId changed
							var executeSave = mxUtils.bind(this, function(realOverwrite)
							{
								file.saveLevel = 9;
								
								if (realOverwrite)
								{
									doExecuteSave(realOverwrite);
								}
								else
								{
									var acceptResponse = true;
									
									// Allow for re-auth flow with 3x timeout
									var timeoutThread = window.setTimeout(mxUtils.bind(this, function()
									{
										acceptResponse = false;
										error({code: App.ERROR_TIMEOUT, message: mxResources.get('timeout')});
									}), 3 * this.ui.timeout);
									
									this.executeRequest({
										url: '/files/' + file.getId() + '?supportsTeamDrives=true&fields=' + this.catchupFields
									},
									mxUtils.bind(this, function(desc2)
									{
										window.clearTimeout(timeoutThread);
										
										if (acceptResponse)
										{
											file.saveLevel = 13;
											
											try
											{
												// Checks head revision ID and updates etag or returns conflict
												if (desc2 != null && desc2.headRevisionId == head0)
												{
													if (urlParams['test'] == '1' && etag != desc2.etag)
													{
														EditorUi.debug('DriveClient: Preflight Etag Update',
															'from', etag, 'to', desc2.etag,
															'rev', file.desc.headRevisionId,
															'response', [desc2], 'file', [file]);
													}
													
													etag = desc2.etag;
													doExecuteSave(realOverwrite);
												}
												else
												{
													error({error: {code: 412}}, desc2);
												}
											}
											catch (e)
											{
												criticalError(e);
											}
										}
									}), mxUtils.bind(this, function(err)
									{
										// Simulated 
										window.clearTimeout(timeoutThread);
										
										if (acceptResponse)
										{
											error(err);
										}
									}));
								}
							});
							
							// Uses saved PNG data for thumbnail
							if (saveAsPng && thumb == null)
							{
								file.saveLevel = 8;
								var img = new Image();
								
								img.onload = mxUtils.bind(this, function()
								{
							    	try
							    	{
										var s = this.thumbnailWidth / img.width;
										
										var canvas = document.createElement('canvas');
									    canvas.width = this.thumbnailWidth;
									    canvas.height = Math.floor(img.height * s);
						
									    var ctx = canvas.getContext('2d');
									    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
									    
									    var temp = canvas.toDataURL();
									    temp = temp.substring(temp.indexOf(',') + 1).replace(/\+/g, '-').replace(/\//g, '_');
									    
									    meta.thumbnail =
										{
											'image': temp,
											'mimeType': 'image/png'
										};
									    
									    executeSave(false);
							    	}
							    	catch (e)
							    	{
							    		executeSave(false)
							    	}
								});
								
								img.src = 'data:image/png;base64,' + data;
							}
							else
							{
								executeSave(false);
							}
						}
						catch (e)
						{
							criticalError(e);
						}
					});
		
					if (saveAsPng)
					{
						this.ui.getEmbeddedPng(mxUtils.bind(this, function(data)
						{
							doExecuteRequest(data, true);
						}), error, (this.ui.getCurrentFile() != file) ? savedData : null);
					}
					else
					{
						doExecuteRequest(savedData, false);
					}
				}
				catch (e)
				{
					criticalError(e);
				}
			});
			
			// Indirection to generate thumbnails if enabled and supported
			// (required because generation of thumbnails is asynchronous)
			var fn = mxUtils.bind(this, function()
			{
				try
				{
					file.saveLevel = 2;

					// NOTE: getThumbnail is asynchronous and returns false if no thumbnails can be created
					if (unloading || saveAsPng || file.constructor == DriveLibrary || !this.enableThumbnails || urlParams['thumb'] == '0' ||
						(file.desc.mimeType != null && file.desc.mimeType.substring(0, 29) != 'application/vnd.jgraph.mxfile') ||
						!this.ui.getThumbnail(this.thumbnailWidth, mxUtils.bind(this, function(canvas)
						{
							// Callback for getThumbnail
							try
							{
								file.thumbTime = null;
								var thumb = null;
	
								try
								{
									if (canvas != null)
									{
										// Security errors are possible
										thumb = canvas.toDataURL('image/png');
									}
									
									// Maximum thumbnail size is 2MB
									if (thumb != null)
									{
										if (thumb.length > this.maxThumbnailSize)
										{
											thumb = null;
										}
										else
										{
											// Converts base64 data into required format for Drive (base64url with no prefix)
											thumb = thumb.substring(thumb.indexOf(',') + 1).replace(/\+/g, '-').replace(/\//g, '_');
										}
									}
								}
								catch (e)
								{
									thumb = null;
								}
								
								doSave(thumb, 'image/png');
							}
							catch (e)
							{
								criticalError(e);
							}
						})))
					{
						// If-branch
						file.thumbTime = null;
						doSave(null, null, file.constructor != DriveLibrary);
					}
				}
				catch (e)
				{
					criticalError(e);
				}
			});
			
			// New revision is required if mime type changes, but the mime type should not be replaced
			// if the file has been converted to the new realtime format. To check this we make sure
			// that the mime type has not changed before updating it in the case of the legacy app.
			// Note: We need to always check the mime type because saveFile cancels previous save
			// attempts so if the save frequency is higher than the time for all retries than you
			// will never see the error message and accumulate lots of changes that will be lost.
			if (noCheck || !revision)
			{
				fn();
			}
			else
			{
				file.saveLevel = 10;
				this.verifyMimeType(file.getId(), fn, true, error);
			}
		}
		else
		{
			this.ui.editor.graph.reset();
			error({message: mxResources.get('readOnly')});
		}
	}
	catch (e)
	{
		criticalError(e);
	}
};

/**
 * Verifies the mime type of the given file ID.
 */
DriveClient.prototype.verifyMimeType = function(fileId, fn, force, error)
{
	if (this.lastMimeCheck == null)
	{
		this.lastMimeCheck = 0;
	}
	
	var now = new Date().getTime();

	if (force || now - this.lastMimeCheck > this.mimeTypeCheckCoolOff)
	{
		this.lastMimeCheck = now;

		if (!this.checkingMimeType)
		{
			this.checkingMimeType = true;
			
			var acceptResponse = true;
			
			// Allow for re-auth flow with 3x timeout
			var timeoutThread = window.setTimeout(mxUtils.bind(this, function()
			{
				acceptResponse = false;
				this.checkingMimeType = false;
				
				if (error != null)
				{
					error({code: App.ERROR_TIMEOUT, message: mxResources.get('timeout')});
				}
			}), 3 * this.ui.timeout);
			
			this.executeRequest({
				url: '/files/' + fileId + '?supportsTeamDrives=true&fields=mimeType'
			}, mxUtils.bind(this, function(resp)
			{
				window.clearTimeout(timeoutThread);
				
				if (acceptResponse)
				{
					this.checkingMimeType = false;
					
					if (resp != null && resp.mimeType == 'application/vnd.jgraph.mxfile.realtime')
					{
						this.redirectToNewApp(error, fileId);
					}
					else if (fn != null)
					{
						fn();
					}
				}
			}), mxUtils.bind(this, function(err)
			{
				window.clearTimeout(timeoutThread);
				
				if (acceptResponse)
				{
					this.checkingMimeType = false;
					
					if (error != null)
					{
						error(err);
					}
				}
			}));
		}
		else if (fn != null)
		{
			fn();
		}
	}
	else if (fn != null)
	{
		fn();
	}
};

/**
 * Checks if the client is authorized and calls the next step.
 */
DriveClient.prototype.redirectToNewApp = function(error, fileId)
{
	this.ui.spinner.stop();
	
	if (!this.redirectDialogShowing)
	{
		this.redirectDialogShowing = true;
		
		var url = window.location.protocol + '//' + this.newAppHostname + '/' + this.ui.getSearch(
			['create', 'title', 'mode', 'url', 'drive', 'splash', 'state']) + '#G' + fileId;
		
		var redirect = mxUtils.bind(this, function()
		{
			this.redirectDialogShowing = false;
			
			if (window.location.href == url)
			{
				window.location.reload();
			}
			else
			{
				window.location.href = url;
			}
		});
		
		if (error != null)
		{
			this.ui.confirm(mxResources.get('redirectToNewApp'), redirect, mxUtils.bind(this, function()
			{
				this.redirectDialogShowing = false;
				
				if (error != null)
				{
					error();
				}
			}));
		}
		else
		{
			this.ui.alert(mxResources.get('redirectToNewApp'), redirect);
		}
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.insertFile = function(title, data, folderId, success, error, mimeType, binary)
{
	mimeType = (mimeType != null) ? mimeType : this.xmlMimeType;
	
	var metadata =
	{
		'mimeType': mimeType,
		'title': title
	};
	
	if (folderId != null)
	{
		metadata.parents = [{'kind': 'drive#fileLink', 'id': folderId}];
	}
	
	// NOTE: Cannot create thumbnail on insert since no ui has no current file
	this.executeRequest(this.createUploadRequest(null, metadata, data, false, binary), mxUtils.bind(this, function(resp)
	{
		if (mimeType == this.libraryMimeType)
		{
			success(new DriveLibrary(this.ui, data, resp));
		}
		else if (resp == false)
		{
			if (error != null)
			{
				error({message: mxResources.get('errorSavingFile')});
			}
		}
		else
		{
			success(new DriveFile(this.ui, data, resp));
		}
	}), error);
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.createUploadRequest = function(id, metadata, data, revision, binary, etag, pinned)
{
	binary = (binary != null) ? binary : false;
	var bd = '-------314159265358979323846';
	var delim = '\r\n--' + bd + '\r\n';
	var close = '\r\n--' + bd + '--';
	var ctype = 'application/octect-stream';
	
	var headers = {'Content-Type' : 'multipart/mixed; boundary="' + bd + '"'};
	
	if (etag != null)
	{
		headers['If-Match'] = etag;
	}

	var reqObj = 
	{
		'fullUrl': 'https://content.googleapis.com/upload/drive/v2/files' + (id != null ? '/' + id : '') + '?uploadType=multipart&supportsTeamDrives=true&fields=' + this.allFields,
		'method': (id != null) ? 'PUT' : 'POST',
		'headers': headers,
		'params': delim + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) + delim +
			'Content-Type: ' + ctype + '\r\n' + 'Content-Transfer-Encoding: base64\r\n' + '\r\n' +
			((data != null) ? (binary) ? data : Base64.encode(data) : '') + close
	}
	
	if (!revision)
	{
		reqObj.url += '&newRevision=false';
	}
	
	if (pinned)
	{
		reqObj.url += '&pinned=true';
	}
	
	return reqObj;
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.pickFile = function(fn, acceptAllFiles)
{
	this.filePickerCallback = (fn != null) ? fn : mxUtils.bind(this, function(id)
	{
		this.ui.loadFile('G' + id);
	});
	
	this.filePicked = mxUtils.bind(this, function(data)
	{
		if (data.action == google.picker.Action.PICKED)
		{
    		this.filePickerCallback(data.docs[0].id);
		}
	});
	
	if (this.ui.spinner.spin(document.body, mxResources.get('authorizing')))
	{
		this.execute(mxUtils.bind(this, function()
		{
			try
			{
				this.ui.spinner.stop();

				// Reuses picker as long as token doesn't change.
				var name = (acceptAllFiles) ? 'genericPicker' : 'filePicker';
				
				// Click on background closes dialog as workaround for blocking dialog
				// states such as 401 where the dialog cannot be closed and blocks UI
				var exit = mxUtils.bind(this, function(evt)
				{
					// Workaround for click from appIcon on second call
					if (mxEvent.getSource(evt).className == 'picker modal-dialog-bg picker-dialog-bg')
					{
						mxEvent.removeListener(document, 'click', exit);
						this[name].setVisible(false);
					}
				});
				
				if (this[name] == null || this[name + 'Token'] != this.token)
				{
					// FIXME: Dispose not working
	//				if (this[name] != null)
	//				{
	//					console.log(name, this[name]);
	//					this[name].dispose();
	//				}
					
					this[name + 'Token'] = this.token;
	
					// Pseudo-hierarchical directory view, see
					// https://groups.google.com/forum/#!topic/google-picker-api/FSFcuJe7icQ
					var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
				        	.setParent('root')
				        	.setIncludeFolders(true);
					
					var view2 = new google.picker.DocsView()
						.setIncludeFolders(true);
					
					var view3 = new google.picker.DocsView()
						.setEnableTeamDrives(true)
						.setIncludeFolders(true);
					
					var view4 = new google.picker.DocsUploadView()
						.setIncludeFolders(true);
	
					if (!acceptAllFiles)
					{
						view.setMimeTypes(this.mimeTypes);
						view2.setMimeTypes(this.mimeTypes);
						view3.setMimeTypes(this.mimeTypes);
					}
					else
					{
						view.setMimeTypes('*/*');
						view2.setMimeTypes('*/*');
						view3.setMimeTypes('*/*');
					}
					
					this[name] = new google.picker.PickerBuilder()
				        .setOAuthToken(this[name + 'Token'])
				        .setLocale(mxLanguage)
				        .setAppId(this.appId)
				        .enableFeature(google.picker.Feature.SUPPORT_TEAM_DRIVES)
				        .addView(view)
				        .addView(view2)
				        .addView(view3)
				        .addView(google.picker.ViewId.RECENTLY_PICKED)
				        .addView(view4)
//				        .setOrigin(window.location.protocol + '//' + window.location.host) //TODO Still there is an error in console about incorrect origin!, it also causes the picker to hang (has a blocking empty iframe on top!)
				        .setCallback(mxUtils.bind(this, function(data)
				        {
				        	if (data.action == google.picker.Action.PICKED ||
				        		data.action == google.picker.Action.CANCEL)
				        	{
				        		mxEvent.removeListener(document, 'click', exit);
				        	}
			        	
				        	if (data.action == google.picker.Action.PICKED)
				    		{
				        		this.filePicked(data);
				    		}
				        })).build();
				}
	
				mxEvent.addListener(document, 'click', exit);
				this[name].setVisible(true);
			}
			catch (e)
			{
				this.ui.spinner.stop();
				this.ui.handleError(e);
			}
		}));
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.pickFolder = function(fn, force)
{
	this.folderPickerCallback = fn;

	// Picker is initialized once and points to this function
	// which is overridden each time to the picker is shown
	var showPicker = mxUtils.bind(this, function()
	{
		try
		{
			if (this.ui.spinner.spin(document.body, mxResources.get('authorizing')))
			{
				this.execute(mxUtils.bind(this, function()
				{
					try
					{
						this.ui.spinner.stop();
		
						// Reuses picker as long as token doesn't change.
						var name = 'folderPicker';
						
						// Click on background closes dialog as workaround for blocking dialog
						// states such as 401 where the dialog cannot be closed and blocks UI
						var exit = mxUtils.bind(this, function(evt)
						{
							// Workaround for click from appIcon on second call
							if (mxEvent.getSource(evt).className == 'picker modal-dialog-bg picker-dialog-bg')
							{
								mxEvent.removeListener(document, 'click', exit);
								this[name].setVisible(false);
							}
						});
						
						if (this[name] == null || this[name + 'Token'] != this.token)
						{
							// FIXME: Dispose not working
			//				if (this[name] != null)
			//				{
			//					console.log(name, this[name]);
			//					this[name].dispose();
			//				}
							
							this[name + 'Token'] = this.token;
			
							// Pseudo-hierarchical directory view, see
							// https://groups.google.com/forum/#!topic/google-picker-api/FSFcuJe7icQ
							var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
								.setParent('root')
								.setIncludeFolders(true)
								.setSelectFolderEnabled(true)
					        		.setMimeTypes('application/vnd.google-apps.folder');
							
							var view2 = new google.picker.DocsView()
								.setIncludeFolders(true)
								.setSelectFolderEnabled(true)
								.setMimeTypes('application/vnd.google-apps.folder');
							
							var view3 = new google.picker.DocsView()
								.setIncludeFolders(true)
								.setEnableTeamDrives(true)
								.setSelectFolderEnabled(true)
								.setMimeTypes('application/vnd.google-apps.folder');
							
							this[name] = new google.picker.PickerBuilder()
								.setSelectableMimeTypes('application/vnd.google-apps.folder')
						        .setOAuthToken(this[name + 'Token'])
						        .setLocale(mxLanguage)
						        .setAppId(this.appId)
							    .enableFeature(google.picker.Feature.SUPPORT_TEAM_DRIVES)
						        .addView(view)
						        .addView(view2)
						        .addView(view3)
						        .addView(google.picker.ViewId.RECENTLY_PICKED)
						        .setTitle(mxResources.get('pickFolder'))
//						        .setOrigin(window.location.protocol + '//' + window.location.host) //TODO Still there is an error in console about incorrect origin!, it also causes the picker to hang (has a blocking empty iframe on top!)
						        .setCallback(mxUtils.bind(this, function(data)
						        {
						        	if (data.action == google.picker.Action.PICKED ||
						        		data.action == google.picker.Action.CANCEL)
						        	{
						        		mxEvent.removeListener(document, 'click', exit);
						        	}
						        	
					        		this.folderPickerCallback(data);
						        })).build();
						}
			
						mxEvent.addListener(document, 'click', exit);
						this[name].setVisible(true);
					}
					catch (e)
					{
						this.ui.spinner.stop();
						this.ui.handleError(e);
					}
				}));
			}
		}
		catch (e)
		{
			this.ui.handleError(e);
		}
	});
	
	if (force)
	{
		showPicker();
	}
	else
	{
		this.ui.confirm(mxResources.get('useRootFolder'), mxUtils.bind(this, function()
		{
			this.folderPickerCallback({action: google.picker.Action.PICKED,
				docs: [{type: 'folder', id: 'root'}]});
		}), mxUtils.bind(this, function()
		{
			showPicker();
		}), mxResources.get('yes'), mxResources.get('noPickFolder') + '...', true);
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.pickLibrary = function(fn)
{
	this.filePickerCallback = fn;
	
	this.filePicked = mxUtils.bind(this, function(data)
	{
		if (data.action == google.picker.Action.PICKED)
		{
    		this.filePickerCallback(data.docs[0].id);
		}
    	else if (data.action == google.picker.Action.CANCEL && this.ui.getCurrentFile() == null)
		{
    		this.ui.showSplash();
		}
	});
	
	if (this.ui.spinner.spin(document.body, mxResources.get('authorizing')))
	{
		this.execute(mxUtils.bind(this, function()
		{
			try
			{
				this.ui.spinner.stop();
				
				// Click on background closes dialog as workaround for blocking dialog
				// states such as 401 where the dialog cannot be closed and blocks UI
				var exit = mxUtils.bind(this, function(evt)
				{
					// Workaround for click from appIcon on second call
					if (mxEvent.getSource(evt).className == 'picker modal-dialog-bg picker-dialog-bg')
					{
						mxEvent.removeListener(document, 'click', exit);
						this.libraryPicker.setVisible(false);
					}
				});
				
				// Reuses picker as long as token doesn't change
				
				if (this.libraryPicker == null || this.libraryPickerToken != this.token)
				{
					// FIXME: Dispose not working
	//				if (this[name] != null)
	//				{
	//					console.log(name, this[name]);
	//					this[name].dispose();
	//				}
					
					this.libraryPickerToken = this.token;
	
					// Pseudo-hierarchical directory view, see
					// https://groups.google.com/forum/#!topic/google-picker-api/FSFcuJe7icQ
					var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
				        	.setParent('root')
				        	.setIncludeFolders(true)
						.setMimeTypes(this.libraryMimeType + ',application/xml,text/plain,application/octet-stream');
					
					var view2 = new google.picker.DocsView()
			        		.setIncludeFolders(true)
						.setMimeTypes(this.libraryMimeType + ',application/xml,text/plain,application/octet-stream');
				
					var view3 = new google.picker.DocsView()
						.setEnableTeamDrives(true)
						.setIncludeFolders(true)
						.setMimeTypes(this.libraryMimeType + ',application/xml,text/plain,application/octet-stream');
					
					var view4 = new google.picker.DocsUploadView()
						.setIncludeFolders(true);
					
				    this.libraryPicker = new google.picker.PickerBuilder()
				        .setOAuthToken(this.libraryPickerToken)
				        .setLocale(mxLanguage)
				        .setAppId(this.appId)
				        .enableFeature(google.picker.Feature.SUPPORT_TEAM_DRIVES)
				        .addView(view)
				        .addView(view2)
				        .addView(view3)
				        .addView(google.picker.ViewId.RECENTLY_PICKED)
				        .addView(view4)
//				        .setOrigin(window.location.protocol + '//' + window.location.host) //TODO Still there is an error in console about incorrect origin!, it also causes the picker to hang (has a blocking empty iframe on top!)
				        .setCallback(mxUtils.bind(this, function(data)
				        {
					        	if (data.action == google.picker.Action.PICKED ||
					        		data.action == google.picker.Action.CANCEL)
					        	{
					        		mxEvent.removeListener(document, 'click', exit);
					        	}
					        	
					        	if (data.action == google.picker.Action.PICKED)
					    		{
					        		this.filePicked(data);
					    		}
				        })).build();
				}
				
				mxEvent.addListener(document, 'click', exit);
				this.libraryPicker.setVisible(true);
			}
			catch (e)
			{
				this.ui.spinner.stop();
				this.ui.handleError(e);
			}
		}));
	}
};

/**
 * Translates this point by the given vector.
 * 
 * @param {number} dx X-coordinate of the translation.
 * @param {number} dy Y-coordinate of the translation.
 */
DriveClient.prototype.showPermissions = function(id)
{
	var fallback = mxUtils.bind(this, function()
	{
		var dlg = new ConfirmDialog(this.ui, mxResources.get('googleSharingNotAvailable'), mxUtils.bind(this, function()
		{
			this.ui.editor.graph.openLink('https://drive.google.com/open?id=' + id);
		}), null, mxResources.get('open'), null, null, null, null, IMAGE_PATH + '/google-share.png');
		this.ui.showDialog(dlg.container, 360, 190, true, true);
		dlg.init();
	});
	
	if (this.sharingFailed)
	{
		fallback();
	}
	else
	{
		this.checkToken(mxUtils.bind(this, function()
		{
			try
			{
				var shareClient = new gapi.drive.share.ShareClient(this.appId);
				shareClient.setOAuthToken(this.token);
				shareClient.setItemIds([id]);
				shareClient.showSettingsDialog();
				
				// Workaround for https://stackoverflow.com/questions/54753169 is to check
				// if "sharing is unavailable" is showing and invoke a fallback dialog
				if ('MutationObserver' in window)
				{
					if (this.sharingObserver != null)
					{
						this.sharingObserver.disconnect();
						this.sharingObserver = null;
					}
	
					// Tries again even if observer was still around as the user may have
					// closed the dialog while waiting. TODO: Find condition to disconnect
					// observer when dialog is closed (use removedNodes?).
					this.sharingObserver = new MutationObserver(mxUtils.bind(this, function(mutations)
					{
						var done = false;
						
						for (var i = 0; i < mutations.length; i++)
						{
							for (var j = 0; j < mutations[i].addedNodes.length; j++)
							{
								var child = mutations[i].addedNodes[j];
	
								if (child.nodeName == 'BUTTON' && child.getAttribute('name') == 'ok' &&
					        		child.parentNode != null && child.parentNode.parentNode != null &&
					        		child.parentNode.parentNode.getAttribute('role') == 'dialog')
					        	{
				        			this.sharingFailed = true;
					        		child.click();
				        			fallback();
				        			done = true;
					        	}
					        	else if (child.nodeName == 'DIV' && child.className == 'shr-q-shr-r-shr-xb')
					        	{
					        		done = true;
					        	}
					        }
					    }
						
						if (done)
						{
			        		this.sharingObserver.disconnect();
		        			this.sharingObserver = null;
						}
						
					}));
					
					this.sharingObserver.observe(document, {childList: true, subtree: true});
				}
			}
			catch (e)
			{
				this.ui.handleError(e);
			}
		}));
	}
};

DriveClient.prototype.clearPersistentToken = function()
{
	//Since we have multiple accounts now, full deletion is not possible
	var authInfo = JSON.parse(this.getPersistentToken(true)) || {};
	
	//Delete current user info
	delete authInfo.current;
	delete authInfo[this.userId];
	
	//Set the next user as current
	for (var id in authInfo)
	{
		authInfo.current = {userId: id, expires: 0}; //An expired token
		break;
	}
	
	DrawioClient.prototype.setPersistentToken.call(this, JSON.stringify(authInfo));
};

DriveClient.prototype.setPersistentToken = function(userAuthInfo, sessionOnly)
{
	var authInfo = JSON.parse(this.getPersistentToken(true)) || {};
	
	userAuthInfo.userId = this.userId;
	authInfo.current = userAuthInfo;
	authInfo[this.userId] = {
		refresh_token: userAuthInfo.refresh_token,
		user: this.user
	};
	
	DrawioClient.prototype.setPersistentToken.call(this, JSON.stringify(authInfo), sessionOnly);
};
